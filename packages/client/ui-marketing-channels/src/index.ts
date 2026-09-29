/**
 * Marketing channel catalog, node half.
 *
 * The browser half renders the catalog; this half is what lets an operator
 * finish a binding without touching a command line. It owns four routes under
 * `/x/channels` and the channel configuration file, both deliberately narrow:
 *
 * - `GET  /x/channels/status`        read the config, its path, and the health facts
 * - `POST /x/channels/accounts`      upsert or remove one account
 * - `POST /x/channels/login`         start the QR login for one account (opens a real browser window)
 * - `GET  /x/channels/login-status`  report that login's progress
 *
 * Requests carry the same trust check the rest of the GUI uses, so a foreign
 * page cannot drive these. Nothing here writes a credential: the login window
 * keeps its session inside the account's own browser profile directory, and the
 * config file records only that directory.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Services this plugin needs: the HTTP carrier, and lazily the connection trust check. */
export const inject = ['webServer', 'connection']

/** Route prefix owned by this plugin. */
export const CHANNELS_ROUTE = '/x/channels'

/** Request bodies are small JSON objects; anything larger is hostile. */
/** Environment reads stay behind one widened view: the client-shared types narrow the map. */
const envOf = (): Record<string, string | undefined> => process.env as unknown as Record<string, string | undefined>

/** Request bodies are small JSON objects; anything larger is hostile. */
const MAX_BODY_BYTES = 64 * 1024

/** Harness home, matching the launcher's resolution when the variable is absent. */
const DSH_HOME = envOf().DSH_HOME ?? join(homedir(), '.dsh')

/** Where channel accounts live: beside the harness, next to the login profiles they reference. */
export const CHANNELS_DIR = join(DSH_HOME, 'channels')

/** The one configuration file this plugin reads and writes. */
export const CHANNELS_CONFIG_PATH = join(CHANNELS_DIR, 'channels.config.json')

/** The content pipeline skill that performs the actual login and draft filling. */
const SKILL_DIR = join(DSH_HOME, 'skills', 'sanwu-marketing-pipeline')

/** Trust surface consumed here; the browser-side connection package owns the full type. */
interface ChannelConnection {
  requestRejection(request: { readonly headers: IncomingMessage['headers'] }): 401 | 403 | undefined
}

/** One account as stored in the configuration file. */
interface StoredAccount {
  id: string
  label: string
  owner: string
  persona?: string
  dailyLimit?: number
  enabled?: boolean
  auth?: { kind?: string; profileDir?: string; secretRef?: string; grantRef?: string }
  notes?: string
}

/** One channel as stored in the configuration file. */
interface StoredChannel {
  id: string
  name?: string
  tier?: string
  enabled?: boolean
  playbook?: string
  publishMode?: string
  accounts: StoredAccount[]
  targets?: readonly { id: string; label?: string; forum?: string; allowed?: boolean }[]
}

/** The configuration document, accepted loosely so an operator's edit never wedges the page. */
interface ChannelsConfig {
  _schema?: string
  defaults?: { dailyLimitPerAccount?: number; kbRoot?: string; timezone?: string; requireHumanReview?: boolean }
  channels: StoredChannel[]
  [key: string]: unknown
}

/** The web-host surface this plugin consumes. */
interface WebHost {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** The host plugin context this half needs. */
interface HostContext {
  webServer: WebHost
  effect(callback: () => () => void, label: string): void
}

/** A skeleton written when no configuration exists yet. */
function emptyConfig(): ChannelsConfig {
  return {
    _schema: 'sanwu-channels/1',
    _readme: '渠道接入配置。只写引用，不写密码、cookie 或 token 明文；真实登录态保存在各账号自己的浏览器 profile 目录里。',
    defaults: { timezone: 'Asia/Shanghai', dailyLimitPerAccount: 3, requireHumanReview: true },
    channels: [],
  }
}

/** Read the configuration, creating the skeleton on first use. */
function readConfig(): ChannelsConfig {
  if (!existsSync(CHANNELS_CONFIG_PATH)) {
    mkdirSync(CHANNELS_DIR, { recursive: true })
    writeFileSync(CHANNELS_CONFIG_PATH, `${JSON.stringify(emptyConfig(), null, 2)}\n`)
  }
  const parsed: unknown = JSON.parse(readFileSync(CHANNELS_CONFIG_PATH, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as ChannelsConfig).channels)) {
    throw new Error('channels.config.json 结构不对：缺少 channels 数组')
  }
  return parsed as ChannelsConfig
}

/** Write the configuration back to the file the whole team reads. */
function writeConfig(config: ChannelsConfig): void {
  mkdirSync(CHANNELS_DIR, { recursive: true })
  writeFileSync(CHANNELS_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`)
}

/** Expand a leading `~` in a configured path. */
function expandHome(path: string): string {
  return path.replace(/^~(?=\/)/, homedir())
}

/**
 * Whether this account has a completed login. The login script creates the
 * profile directory before the operator scans, so directory existence alone
 * would report a started-but-unfinished login as bound; the marker file the
 * script writes on success is the honest signal.
 */
function profileReady(account: StoredAccount): boolean {
  const dir = account.auth?.profileDir
  return typeof dir === 'string' && existsSync(join(expandHome(dir), '.sanwu-login-ok.json'))
}

/** Where this account's login progress is recorded. */
function loginStatusPath(channelId: string, accountId: string): string {
  return join(CHANNELS_DIR, `login-${channelId}-${accountId}.json`)
}

/** Read one account's login progress, or null when nothing ran yet. */
function readLoginStatus(channelId: string, accountId: string): unknown {
  const path = loginStatusPath(channelId, accountId)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    return null
  }
}

/** The health lines an operator reads, expressed in consequences rather than codes. */
function healthOf(config: ChannelsConfig): readonly { level: string; text: string }[] {
  const lines: { level: string; text: string }[] = []
  const accounts = config.channels.flatMap(channel => channel.accounts.map(account => ({ channel, account })))
  if (config.channels.length === 0) lines.push({ level: 'warn', text: '还没有任何渠道，先添加一个平台' })
  if (accounts.length === 0) lines.push({ level: 'warn', text: '还没有绑定任何账号，内容流水线无法填草稿' })
  const profiles = new Map<string, string>()
  for (const { channel, account } of accounts) {
    const where = `${channel.name ?? channel.id} · ${account.label}`
    if (account.owner === undefined || account.owner.trim() === '' || account.owner === '待指派') {
      lines.push({ level: 'warn', text: `${where}：负责人未指派，出问题无法定位` })
    }
    const dir = account.auth?.profileDir
    if (typeof dir === 'string') {
      const key = expandHome(dir)
      const owner = profiles.get(key)
      if (owner !== undefined) lines.push({ level: 'error', text: `${where}：与「${owner}」共用同一个登录态，矩阵号必须各自独立` })
      else profiles.set(key, where)
    } else if (account.auth?.kind === 'api-key' && typeof account.auth.secretRef === 'string') {
      const name = account.auth.secretRef.replace(/^env:/, '')
      if (envOf()[name] === undefined) lines.push({ level: 'warn', text: `${where}：密钥还没有配置到这台机器上` })
    }
    if (account.dailyLimit !== undefined && account.dailyLimit > 5) {
      lines.push({ level: 'warn', text: `${where}：每日上限 ${account.dailyLimit} 条偏高，注意平台风控` })
    }
  }
  if (lines.length === 0) lines.push({ level: 'ok', text: '体检通过：渠道、账号、负责人与限额都正常' })
  return lines
}

/** JSON response; these facts are live, so nothing is cached. */
function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/** Read a bounded JSON request body; `undefined` means the caller sent nothing. */
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('请求体过大')
    chunks.push(buffer)
  }
  if (size === 0) return undefined
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

/**
 * Contribute the channel administration routes to the web host.
 * @param ctx - the host plugin context.
 */
export function apply(ctx: HostContext): void {
  /** Answer a foreign or unauthenticated request; true when it was rejected. */
  const rejected = (req: IncomingMessage, res: ServerResponse): boolean => {
    let connection: ChannelConnection | undefined
    try {
      connection = (ctx as unknown as { connection?: ChannelConnection }).connection
      if (connection === undefined || typeof connection.requestRejection !== 'function') return false
      const rejection = connection.requestRejection(req)
      if (rejection === undefined) return false
      res.statusCode = rejection
      res.end()
      return true
    } catch (error) {
      // Fail closed and leave the evidence behind instead of taking the process down.
      try {
        writeFileSync(join(CHANNELS_DIR, 'guard-error.json'), `${JSON.stringify({ at: new Date().toISOString(), error: String(error), kind: typeof connection })} \n`)
      } catch { /* diagnostic only */ }
      res.statusCode = 403
      res.end()
      return true
    }
  }

  // 1. Status: the config, where it lives, and the operator-facing health lines.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${CHANNELS_ROUTE}/status`,
    handler: (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
      try {
        const config = readConfig()
        const channels = config.channels.map(channel => ({
          ...channel,
          accounts: channel.accounts.map(account => ({
            ...account,
            bound: account.auth?.kind === 'api-key'
              ? process.env[(account.auth.secretRef ?? '').replace(/^env:/, '')] !== undefined
              : profileReady(account),
          })),
        }))
        sendJson(res, 200, {
          ok: true,
          path: CHANNELS_CONFIG_PATH,
          defaults: config.defaults ?? {},
          channels,
          health: healthOf(config),
          loginAvailable: existsSync(join(SKILL_DIR, 'scripts', 'login.mjs')),
        })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String((error as Error).message ?? error) })
      }
    },
  }), `marketing-channels: GET ${CHANNELS_ROUTE}/status`)

  // 2. Accounts: upsert or remove one account in the file the whole team reads.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${CHANNELS_ROUTE}/accounts`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
      try {
        const body = await readBody(req) as {
          channel?: string
          channelName?: string
          op?: 'upsert' | 'remove'
          account?: Partial<StoredAccount>
        } | undefined
        const channelId = body?.channel
        if (typeof channelId !== 'string' || channelId === '') throw new Error('缺少 channel')
        const config = readConfig()
        let channel = config.channels.find(item => item.id === channelId)
        if (channel === undefined) {
          channel = { id: channelId, name: body?.channelName ?? channelId, accounts: [] }
          config.channels.push(channel)
        }
        if (body?.op === 'remove') {
          const id = body.account?.id
          channel.accounts = channel.accounts.filter(item => item.id !== id)
        } else {
          const incoming = body?.account ?? {}
          if (typeof incoming.id !== 'string' || incoming.id === '') throw new Error('缺少账号 id')
          if (typeof incoming.label !== 'string' || incoming.label.trim() === '') throw new Error('账号名称不能为空')
          const defaultProfile = `~/.dsh/skills/sanwu-marketing-pipeline/.browser/${channelId}/${incoming.id}`
          const existing = channel.accounts.find(item => item.id === incoming.id)
          const next: StoredAccount = {
            id: incoming.id,
            label: incoming.label,
            owner: incoming.owner ?? existing?.owner ?? '待指派',
            persona: incoming.persona ?? existing?.persona ?? '',
            dailyLimit: incoming.dailyLimit ?? existing?.dailyLimit ?? config.defaults?.dailyLimitPerAccount ?? 3,
            enabled: incoming.enabled ?? existing?.enabled ?? true,
            auth: { kind: incoming.auth?.kind ?? existing?.auth?.kind ?? 'browser-profile', profileDir: incoming.auth?.profileDir ?? existing?.auth?.profileDir ?? defaultProfile },
            notes: incoming.notes ?? existing?.notes ?? '',
          }
          const index = channel.accounts.findIndex(item => item.id === next.id)
          if (index >= 0) channel.accounts[index] = next
          else channel.accounts.push(next)
        }
        writeConfig(config)
        sendJson(res, 200, { ok: true, path: CHANNELS_CONFIG_PATH })
      } catch (error) {
        sendJson(res, 400, { ok: false, error: String((error as Error).message ?? error) })
      }
    },
  }), `marketing-channels: POST ${CHANNELS_ROUTE}/accounts`)

  // 3. Login: open the platform's login page in this account's own browser profile.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${CHANNELS_ROUTE}/login`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
      try {
        const body = await readBody(req) as { channel?: string; account?: string } | undefined
        const channelId = body?.channel
        const accountId = body?.account
        if (typeof channelId !== 'string' || typeof accountId !== 'string') throw new Error('缺少 channel 或 account')
        const script = join(SKILL_DIR, 'scripts', 'login.mjs')
        if (!existsSync(script)) {
          sendJson(res, 200, { ok: false, reason: 'no-script', detail: `缺少登录脚本：${script}` })
          return
        }
        const config = readConfig()
        const channel = config.channels.find(item => item.id === channelId)
        const account = channel?.accounts.find(item => item.id === accountId)
        if (account === undefined) throw new Error('配置里找不到这个账号')
        const child = spawn(process.execPath, [script, '--channel', channelId, '--account', accountId], {
          detached: true,
          stdio: 'ignore',
        })
        child.unref()
        sendJson(res, 200, { ok: true, pid: child.pid })
      } catch (error) {
        sendJson(res, 400, { ok: false, error: String((error as Error).message ?? error) })
      }
    },
  }), `marketing-channels: POST ${CHANNELS_ROUTE}/login`)

  // 4. Login progress: what the login window last reported, plus the profile's own evidence.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${CHANNELS_ROUTE}/login-status`,
    handler: (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        const channelId = url.searchParams.get('channel') ?? ''
        const accountId = url.searchParams.get('account') ?? ''
        const config = readConfig()
        const account = config.channels.find(item => item.id === channelId)?.accounts.find(item => item.id === accountId)
        sendJson(res, 200, {
          ok: true,
          bound: account === undefined ? false : profileReady(account),
          progress: readLoginStatus(channelId, accountId),
        })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: String((error as Error).message ?? error) })
      }
    },
  }), `marketing-channels: GET ${CHANNELS_ROUTE}/login-status`)
}
