/**
 * Saved content pipelines, node half.
 *
 * A flow is one reusable content pipeline: a brief, the reference images, the
 * target channels, and the ordered steps that turn them into channel-ready
 * assets. Flows live beside the channel accounts (`$DSH_HOME/flows`) because the
 * sidebar region that shows them is installation-level, not session-scoped: a
 * global section has no workspace to resolve.
 *
 * Routes under `/x/flows`:
 * - `GET  /x/flows`            every saved flow, plus each channel's binding state
 * - `POST /x/flows`            save or delete one flow
 * - `POST /x/flows/run`        open a run directory and start the scriptable steps
 * - `GET  /x/flows/run`        read one run's progress
 *
 * Runs stop at the model steps on purpose: 选选题 and 写稿 are performed in the
 * conversation, where the operator can see and correct them, and the human
 * review gate before 填草稿 stays mandatory.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Services this plugin needs: the HTTP carrier, and the connection trust check. */
export const inject = ['webServer', 'connection']

/** Route prefix owned by this plugin. */
export const FLOWS_ROUTE = '/x/flows'

/** Request bodies are small JSON objects; anything larger is hostile. */
const MAX_BODY_BYTES = 64 * 1024

/** Uploads are reference material, not documents: cap one file at 48 MB. */
const MAX_UPLOAD_BYTES = 48 * 1024 * 1024

/** Harness home, matching the launcher's resolution when the variable is absent. */
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')

/** Where saved flows and their runs live. */
export const FLOWS_DIR = join(DSH_HOME, 'flows')

/** Where a run writes its artifacts. */
export const RUNS_DIR = join(FLOWS_DIR, 'runs')

/** Channel accounts, read only to tell the wizard which targets can be filled. */
const CHANNELS_CONFIG = join(DSH_HOME, 'channels', 'channels.config.json')

/** The content pipeline skill whose scripts perform the deterministic steps. */
const SKILL_DIR = join(DSH_HOME, 'skills', 'sanwu-marketing-pipeline')

/** One step of a flow. */
interface FlowStep {
  id: string
  name: string
  /** Who performs it: a script, the model, or the operator. */
  kind: 'tool' | 'agent' | 'human'
  /** Whether the step waits for the operator. */
  gate?: 'none' | 'review' | 'approval'
}

/** One saved flow. */
interface Flow {
  id: string
  name: string
  owner: string
  mode: 'manual' | 'ai'
  createdAt: string
  updatedAt: string
  brief: string
  images: string[]
  targets: string[]
  /** Which accounts of each target channel a run pushes to. */
  accounts?: Record<string, readonly string[]>
  /** Uploaded reference material (images, video, files) as absolute paths. */
  assets?: readonly string[]
  steps: FlowStep[]
}

/** The default seven-step template the wizard starts from. */
const DEFAULT_STEPS: readonly FlowStep[] = [
  { id: 'hot', name: '抓热点', kind: 'tool' },
  { id: 'topic', name: '选选题', kind: 'agent' },
  { id: 'write', name: '写稿', kind: 'agent' },
  { id: 'cover', name: '出封面', kind: 'tool' },
  { id: 'images', name: '配图渲染', kind: 'tool' },
  { id: 'preview', name: '预览', kind: 'tool', gate: 'review' },
  { id: 'draft', name: '填草稿', kind: 'tool', gate: 'approval' },
]

/** Trust surface consumed here; the browser-side connection package owns the full type. */
interface FlowConnection {
  requestRejection(request: { readonly headers: IncomingMessage['headers'] }): 401 | 403 | undefined
}

/** The host plugin context this half needs. */
interface HostContext {
  webServer: {
    register(route: {
      kind: 'exact' | 'prefix'
      path: string
      handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
    }): () => void
  }
  effect(callback: () => () => void, label: string): void
}

/** Ledger of the flows on disk, keyed by id. */
function listFlows(): Flow[] {
  if (!existsSync(FLOWS_DIR)) return []
  return readdirSync(FLOWS_DIR)
    .filter(name => name.endsWith('.json'))
    .map((name) => {
      try {
        return JSON.parse(readFileSync(join(FLOWS_DIR, name), 'utf8')) as Flow
      } catch {
        return undefined
      }
    })
    .filter((flow): flow is Flow => flow !== undefined)
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1))
}

/** Read the channel accounts so the wizard can show what each target still needs. */
function listChannels(): readonly unknown[] {
  if (!existsSync(CHANNELS_CONFIG)) return []
  try {
    const config = JSON.parse(readFileSync(CHANNELS_CONFIG, 'utf8')) as { channels?: unknown[] }
    return config.channels ?? []
  } catch {
    return []
  }
}


/** Where each step leaves its artifact, so progress is read from evidence. */
const STEP_ARTIFACTS: Record<string, string> = {
  hot: '01-hot.json',
  topic: '02-topics.json',
  write: '03-article.md',
  cover: '04-cover.png',
  images: '05-images',
  preview: '06-preview.html',
  draft: '07-draft',
}

/**
 * Model prices in CNY per 1M tokens, used for an estimate only: a run's real
 * cost depends on the provider's billing (cache hits, tiering, promotions).
 */
const MODEL_PRICE: Record<string, { in: number; out: number }> = {
  'deepseek-chat': { in: 2, out: 8 },
  'deepseek-reasoner': { in: 4, out: 16 },
  'deepseek-v4-flash': { in: 1, out: 4 },
}

/** Filesystem evidence for one run: which steps finished, and when. */
function readProgress(id: string): unknown {
  const dir = join(RUNS_DIR, id)
  const recordPath = join(dir, 'run.json')
  if (!existsSync(recordPath)) return null
  const record = JSON.parse(readFileSync(recordPath, 'utf8')) as {
    id: string
    flowName: string
    at: string
    steps: { id: string; name: string; kind: string }[]
  }
  let metrics: {
    model?: string
    promptTokens?: number
    completionTokens?: number
    perStep?: Record<string, { model?: string; promptTokens?: number; completionTokens?: number }>
  } = {}
  try { metrics = JSON.parse(readFileSync(join(dir, 'metrics.json'), 'utf8')) } catch { /* not recorded yet */ }

  let previous = Date.parse(record.at)
  const steps = record.steps.map((step) => {
    const artifact = STEP_ARTIFACTS[step.id]
    const path = artifact === undefined ? undefined : join(dir, artifact)
    const done = path !== undefined && existsSync(path)
    let endedAt: number | undefined
    if (done) {
      try { endedAt = statSync(path).mtimeMs } catch { endedAt = undefined }
    }
    const elapsedMs = done && endedAt !== undefined ? Math.max(0, endedAt - previous) : 0
    if (done && endedAt !== undefined) previous = endedAt
    const stepMetrics = metrics.perStep?.[step.id]
    return {
      id: step.id, name: step.name, kind: step.kind,
      state: done ? 'done' : 'pending',
      elapsedMs,
      model: stepMetrics?.model ?? (done ? metrics.model : undefined),
      promptTokens: stepMetrics?.promptTokens,
      completionTokens: stepMetrics?.completionTokens,
    }
  })
  const doneCount = steps.filter(step => step.state === 'done').length
  const totalMs = steps.reduce((sum, step) => sum + step.elapsedMs, 0)
  const inTokens = metrics.promptTokens ?? steps.reduce((sum, step) => sum + (step.promptTokens ?? 0), 0)
  const outTokens = metrics.completionTokens ?? steps.reduce((sum, step) => sum + (step.completionTokens ?? 0), 0)
  const price = metrics.model === undefined ? undefined : MODEL_PRICE[metrics.model]
  const costCny = price === undefined ? undefined : (inTokens / 1e6) * price.in + (outTokens / 1e6) * price.out
  return {
    id, flowName: record.flowName, at: record.at,
    percent: steps.length === 0 ? 0 : Math.round((doneCount / steps.length) * 100),
    steps, totalMs, promptTokens: inTokens, completionTokens: outTokens,
    model: metrics.model, costCny, costEstimated: true,
  }
}

/** JSON response; these facts are live, so nothing is cached. */
function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/** Read a bounded JSON request body. */
async function readBody(req: IncomingMessage, limit: number = MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > limit) throw new Error('请求体过大')
    chunks.push(buffer)
  }
  if (size === 0) return undefined
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

/** A filesystem-safe id for one run directory. */
function runId(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

/**
 * Contribute the flow routes to the web host.
 * @param ctx - the host plugin context.
 */
export function apply(ctx: HostContext): void {
  /** Answer a foreign or unauthenticated request; true when it was rejected. */
  const rejected = (req: IncomingMessage, res: ServerResponse): boolean => {
    try {
      const connection = (ctx as unknown as { connection?: FlowConnection }).connection
      if (connection === undefined || typeof connection.requestRejection !== 'function') return false
      const rejection = connection.requestRejection(req)
      if (rejection === undefined) return false
      res.statusCode = rejection
      res.end()
      return true
    } catch {
      res.statusCode = 403
      res.end()
      return true
    }
  }

  // 1. Every saved flow, plus what each channel still needs before it can be filled.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FLOWS_ROUTE,
    handler: (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
      try {
        sendJson(res, 200, {
          ok: true,
          dir: FLOWS_DIR,
          flows: listFlows(),
          channels: listChannels(),
          template: DEFAULT_STEPS,
          skillInstalled: existsSync(join(SKILL_DIR, 'scripts', 'hot.mjs')),
        })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String((error as Error).message ?? error) })
      }
    },
  }), `marketing-flows: GET ${FLOWS_ROUTE}`)

  // 2. Save or delete one flow.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${FLOWS_ROUTE}/save`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
      try {
        const body = await readBody(req) as { op?: 'save' | 'delete'; flow?: Partial<Flow> } | undefined
        const incoming = body?.flow
        if (incoming === undefined || typeof incoming.id !== 'string' || incoming.id === '') throw new Error('缺少流程 id')
        mkdirSync(FLOWS_DIR, { recursive: true })
        const path = join(FLOWS_DIR, `${incoming.id}.json`)
        if (body?.op === 'delete') {
          rmSync(path, { force: true })
          sendJson(res, 200, { ok: true })
          return
        }
        if (typeof incoming.name !== 'string' || incoming.name.trim() === '') throw new Error('请填写流程名称')
        const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as Flow : undefined
        const flow: Flow = {
          id: incoming.id,
          name: incoming.name.trim(),
          owner: incoming.owner ?? existing?.owner ?? '待指派',
          mode: incoming.mode ?? existing?.mode ?? 'manual',
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          brief: incoming.brief ?? existing?.brief ?? '',
          images: incoming.images ?? existing?.images ?? [],
          targets: incoming.targets ?? existing?.targets ?? [],
          accounts: incoming.accounts ?? existing?.accounts ?? {},
          assets: incoming.assets ?? existing?.assets ?? [],
          steps: incoming.steps ?? existing?.steps ?? [...DEFAULT_STEPS],
        }
        writeFileSync(path, `${JSON.stringify(flow, null, 2)}\n`)
        sendJson(res, 200, { ok: true, flow, path })
      } catch (error) {
        sendJson(res, 400, { ok: false, error: String((error as Error).message ?? error) })
      }
    },
  }), `marketing-flows: POST ${FLOWS_ROUTE}/save`)

  // 3. Open a run: its directory, its brief, and the first scriptable step.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${FLOWS_ROUTE}/run`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (req.method === 'GET') {
          const id = url.searchParams.get('run') ?? ''
          const path = join(RUNS_DIR, id, 'run.json')
          if (!existsSync(path)) { sendJson(res, 404, { ok: false, error: '没有这次运行记录' }); return }
          sendJson(res, 200, { ok: true, run: JSON.parse(readFileSync(path, 'utf8')), progress: readProgress(id) })
          return
        }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        const body = await readBody(req) as { flowId?: string } | undefined
        const flow = listFlows().find(item => item.id === body?.flowId)
        if (flow === undefined) throw new Error('找不到这个流程')
        const id = runId()
        const dir = join(RUNS_DIR, id)
        mkdirSync(dir, { recursive: true })
        const steps = flow.steps.map(step => ({ ...step, state: step.kind === 'agent' ? 'handed-off' : 'pending' }))
        writeFileSync(join(dir, 'request.md'), [
          `# 流程运行请求 · ${flow.name}`, '',
          `- 运行编号：${id}`,
          `- 发起时间：${new Date().toISOString()}`,
          `- 目标渠道：${flow.targets.join('、') || '（未选择）'}`,
          `- 参考图片：${flow.images.length} 张`,
          '', '## 想法', '', flow.brief === '' ? '（未填写）' : flow.brief, '',
          '## 步骤', '', ...flow.steps.map((step, index) => `${index + 1}. ${step.name}（${step.kind}${step.gate === undefined ? '' : ` · 闸门 ${step.gate}`}）`), '',
          '## 下一步', '',
          '用三五数字内容流水线技能继续：选选题 → 写稿 → 封面 → 配图 → 预览 → 填草稿。', '',
        ].join('\n'))
        writeFileSync(join(dir, 'run.json'), `${JSON.stringify({
          id, flowId: flow.id, flowName: flow.name, at: new Date().toISOString(), brief: flow.brief,
          targets: flow.targets, images: flow.images, steps,
        }, null, 2)}\n`)
        // Step 1 is deterministic and needs no model: start it now.
        const hot = join(SKILL_DIR, 'scripts', 'hot.mjs')
        let hotStarted = false
        if (existsSync(hot)) {
          const child = spawn(process.execPath, [hot, '--run', dir], { detached: true, stdio: 'ignore' })
          child.unref()
          hotStarted = true
        }
        sendJson(res, 200, { ok: true, runId: id, dir, hotStarted })
      } catch (error) {
        sendJson(res, 400, { ok: false, error: String((error as Error).message ?? error) })
      }
    },
  }), `marketing-flows: ${FLOWS_ROUTE}/run`)

  // 4. Reference material: store an uploaded image/video/file for one flow.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${FLOWS_ROUTE}/assets`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
      try {
        const body = await readBody(req, MAX_UPLOAD_BYTES) as { flowId?: string; name?: string; dataBase64?: string } | undefined
        const flowId = body?.flowId
        const name = body?.name
        const dataBase64 = body?.dataBase64
        if (typeof flowId !== 'string' || flowId === '') throw new Error('缺少 flowId')
        if (typeof name !== 'string' || name === '') throw new Error('缺少文件名')
        if (typeof dataBase64 !== 'string' || dataBase64 === '') throw new Error('缺少文件内容')
        // Keep the operator's name but strip any path, so a crafted name cannot escape the directory.
        const safe = name.replace(/[\\/]/g, '_').replace(/^\.+/, '_').slice(0, 120)
        const dir = join(FLOWS_DIR, 'assets', flowId)
        mkdirSync(dir, { recursive: true })
        const path = join(dir, `${Date.now()}-${safe}`)
        writeFileSync(path, Buffer.from(dataBase64, 'base64'))
        sendJson(res, 200, { ok: true, path })
      } catch (error) {
        sendJson(res, 400, { ok: false, error: String((error as Error).message ?? error) })
      }
    },
  }), `marketing-flows: POST ${FLOWS_ROUTE}/assets`)
}
