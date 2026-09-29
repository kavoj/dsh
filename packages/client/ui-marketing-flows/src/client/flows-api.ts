/**
 * The client's view of flows: the host routes that persist them, and the tiny
 * selection store the sidebar region and the main panel share.
 */

/** One step of a flow. */
export interface FlowStep {
  readonly id: string
  readonly name: string
  readonly kind: 'tool' | 'agent' | 'human'
  readonly gate?: 'none' | 'review' | 'approval'
}

/** One saved flow. */
export interface Flow {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly mode: 'manual' | 'ai'
  readonly createdAt: string
  readonly updatedAt: string
  readonly brief: string
  readonly images: readonly string[]
  readonly targets: readonly string[]
  /** Which accounts of each target channel this flow pushes to. */
  readonly accounts?: Record<string, readonly string[]>
  /** Uploaded reference material as absolute paths. */
  readonly assets?: readonly string[]
  readonly steps: readonly FlowStep[]
}

/** One channel as the host reports it, trimmed to what the wizard needs. */
export interface ChannelSummary {
  readonly id: string
  readonly name?: string
  readonly tier?: string
  readonly accounts: readonly { readonly id: string; readonly label: string; readonly bound?: boolean }[]
}

/** The whole ledger payload. */
export interface FlowsStatus {
  readonly dir: string
  readonly flows: readonly Flow[]
  readonly channels: readonly ChannelSummary[]
  readonly template: readonly FlowStep[]
  readonly skillInstalled: boolean
}

/** The host's answer to one write. */
export interface HostResult {
  readonly ok: boolean
  readonly error?: string
  readonly reason?: string
  readonly flow?: Flow
  readonly runId?: string
  readonly dir?: string
  readonly hotStarted?: boolean
}

const ROUTE = '/x/flows'

/** Which view the panel shows, shared by the sidebar rows and the panel. */
export type FlowView =
  | { readonly kind: 'list' }
  | { readonly kind: 'create' }
  | { readonly kind: 'detail'; readonly id: string }

let view: FlowView = { kind: 'list' }
const listeners = new Set<() => void>()

/** The panel opener the sidebar rows call; wired by the plugin's apply. */
let openPanel: (() => void) | undefined

/** Hand the plugin's panel selector to the shared navigation helpers. */
export function bindPanelOpener(open: () => void): void {
  openPanel = open
}

/** Subscribe to selection changes (useSyncExternalStore shape). */
export function subscribeView(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Read the current selection. */
export function getView(): FlowView {
  return view
}

/** Move the panel and every sidebar row to one view. */
export function showView(next: FlowView): void {
  view = next
  openPanel?.()
  for (const listener of listeners) listener()
}

/** A stable id from a flow name, so nobody types one. */
export function idFromName(name: string, taken: readonly string[]): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 32)
  const base = slug === '' ? `flow-${Date.now()}` : slug
  if (!taken.includes(base)) return base
  for (let n = 2; n < 100; n += 1) if (!taken.includes(`${base}-${n}`)) return `${base}-${n}`
  return `${base}-${Date.now()}`
}

/** Read flows and channel state from the host. */
export async function fetchFlows(signal?: AbortSignal): Promise<FlowsStatus> {
  const response = await fetch(ROUTE, { ...(signal === undefined ? {} : { signal }), headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`流程服务返回 ${response.status}`)
  const payload = await response.json() as FlowsStatus & { ok?: boolean; error?: string }
  if (payload.ok === false) throw new Error(payload.error ?? '流程服务返回失败')
  return payload
}

/** Save or delete one flow. */
export async function saveFlow(flow: Partial<Flow>, op: 'save' | 'delete' = 'save'): Promise<HostResult> {
  const response = await fetch(`${ROUTE}/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, flow }),
  })
  return await response.json() as HostResult
}

/** Open a run directory and start the first scriptable step. */
export async function startRun(flowId: string): Promise<HostResult> {
  const response = await fetch(`${ROUTE}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ flowId }),
  })
  return await response.json() as HostResult
}

/** One channel account as the channels host reports it. */
export interface ChannelAccount {
  readonly id: string
  readonly label: string
  readonly owner?: string
  readonly dailyLimit?: number
  readonly bound?: boolean
}

/** Read one channel's accounts from the channels host routes. */
export async function fetchChannelAccounts(channelId: string): Promise<readonly ChannelAccount[]> {
  const response = await fetch('/x/channels/status', { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`渠道服务返回 ${response.status}`)
  const payload = await response.json() as { channels?: { id: string; accounts?: ChannelAccount[] }[] }
  return payload.channels?.find(channel => channel.id === channelId)?.accounts ?? []
}

/** Add or update one channel account, so a flow can be finished without leaving the page. */
export async function saveChannelAccount(
  channelId: string,
  channelName: string,
  account: { id: string; label: string; owner: string; dailyLimit: number },
): Promise<HostResult> {
  const response = await fetch('/x/channels/accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channel: channelId,
      channelName,
      op: 'upsert',
      account: {
        id: account.id,
        label: account.label,
        owner: account.owner,
        dailyLimit: account.dailyLimit,
        enabled: true,
        auth: { kind: 'browser-profile', profileDir: `~/.dsh/skills/sanwu-marketing-pipeline/.browser/${channelId}/${account.id}` },
      },
    }),
  })
  return await response.json() as HostResult
}

/** Open this account's own login window on this machine. */
export async function startQrLogin(channelId: string, accountId: string): Promise<HostResult> {
  const response = await fetch('/x/channels/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, account: accountId }),
  })
  return await response.json() as HostResult
}

/** Whether that account's login finished. */
export async function readQrStatus(channelId: string, accountId: string): Promise<{ bound: boolean }> {
  const response = await fetch(`/x/channels/login-status?channel=${encodeURIComponent(channelId)}&account=${encodeURIComponent(accountId)}`, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`渠道服务返回 ${response.status}`)
  const payload = await response.json() as { bound?: boolean }
  return { bound: payload.bound === true }
}

/** A stable id from a label, so an operator never types one. */
export function accountIdFromLabel(channelId: string, label: string, taken: readonly string[]): string {
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 24)
  const base = slug === '' ? `${channelId}-account` : `${channelId}-${slug}`
  if (!taken.includes(base)) return base
  for (let n = 2; n < 100; n += 1) if (!taken.includes(`${base}-${n}`)) return `${base}-${n}`
  return `${base}-${Date.now()}`
}

/** Remove one channel account. */
export async function removeChannelAccount(channelId: string, accountId: string): Promise<HostResult> {
  const response = await fetch('/x/channels/accounts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, op: 'remove', account: { id: accountId } }),
  })
  return await response.json() as HostResult
}

/** Upload one reference file for a flow; resolves to the stored absolute path. */
export async function uploadAsset(flowId: string, file: File): Promise<{ ok: boolean; path?: string; error?: string }> {
  const buffer = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  const response = await fetch('/x/flows/assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ flowId, name: file.name, dataBase64: btoa(binary) }),
  })
  return await response.json() as { ok: boolean; path?: string; error?: string }
}

/** One step's live state, as the host derives it from the run directory. */
export interface RunStep {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly state: 'done' | 'pending'
  readonly elapsedMs: number
  readonly model?: string
  readonly promptTokens?: number
  readonly completionTokens?: number
}

/** One run's progress: percent, per-step evidence, and an estimated cost. */
export interface RunProgress {
  readonly id: string
  readonly flowName: string
  readonly at: string
  readonly percent: number
  readonly steps: readonly RunStep[]
  readonly totalMs: number
  readonly promptTokens: number
  readonly completionTokens: number
  readonly model?: string
  readonly costCny?: number
  readonly costEstimated: boolean
}

/** Read one run's progress. */
export async function fetchProgress(runId: string): Promise<RunProgress | null> {
  const response = await fetch(`/x/flows/run?run=${encodeURIComponent(runId)}`, { headers: { accept: 'application/json' } })
  if (!response.ok) return null
  const payload = await response.json() as { progress?: RunProgress | null }
  return payload.progress ?? null
}

/** Human-readable duration. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes === 0 ? `${seconds} 秒` : `${minutes} 分 ${seconds} 秒`
}
