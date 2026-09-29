/**
 * The operator-facing data layer for channel account binding.
 *
 * Everything here talks to the plugin's own host routes under `/x/channels`, so
 * the page shows the same facts the content pipeline reads and the same file the
 * team shares. Validation stays local so the operator gets an answer before a
 * request is sent; the host remains the authority that writes.
 */

/** One account as the host reports it. */
export interface TeamAccount {
  readonly id: string
  readonly label: string
  readonly owner: string
  readonly persona?: string
  readonly dailyLimit?: number
  readonly enabled?: boolean
  readonly bound: boolean
  readonly auth?: { kind?: string; profileDir?: string; secretRef?: string }
}

/** One channel as the host reports it. */
export interface TeamChannel {
  readonly id: string
  readonly name?: string
  readonly tier?: string
  readonly accounts: readonly TeamAccount[]
}

/** One health line from the host. */
export interface CheckLine {
  readonly level: 'ok' | 'warn' | 'error' | string
  readonly text: string
}

/** The whole status payload. */
export interface ChannelsStatus {
  readonly path: string
  readonly channels: readonly TeamChannel[]
  readonly health: readonly CheckLine[]
  readonly loginAvailable: boolean
}

/** One editable account form. */
export interface AccountDraft {
  readonly id: string
  readonly label: string
  readonly owner: string
  readonly persona: string
  readonly dailyLimit: number
  readonly method: 'qr-login' | 'api-key' | 'oauth'
}

/** A problem the operator can fix in the form. */
export interface FieldProblem {
  readonly field: 'id' | 'label' | 'owner' | 'dailyLimit'
  readonly message: string
}

/** Progress the login window reports. */
export interface LoginProgress {
  readonly state?: 'starting' | 'waiting' | 'ok' | 'timeout' | 'failed'
  readonly note?: string
  readonly at?: string
}

/** The host's answer to one write. */
export interface HostResult {
  readonly ok: boolean
  readonly error?: string
  readonly reason?: string
  readonly detail?: string
}

const ROUTE = '/x/channels'

/** Derive the account id the operator's label implies, so nobody types one. */
export function idFromLabel(channelId: string, label: string, taken: readonly string[]): string {
  const slug = label.trim().toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 24)
  const base = slug === '' ? `${channelId}-account` : `${channelId}-${slug}`
  if (!taken.includes(base)) return base
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`
    if (!taken.includes(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

/** Validate one form; empty means it is ready to send. */
export function validateDraft(draft: AccountDraft, others: readonly TeamAccount[]): readonly FieldProblem[] {
  const problems: FieldProblem[] = []
  if (draft.label.trim() === '') problems.push({ field: 'label', message: '请填写账号名称，例如「三五数字官方号」' })
  if (draft.owner.trim() === '') problems.push({ field: 'owner', message: '请填写负责人，出问题时要能找到人' })
  if (!Number.isInteger(draft.dailyLimit) || draft.dailyLimit < 1) problems.push({ field: 'dailyLimit', message: '每日上限至少为 1' })
  if (draft.dailyLimit > 10) problems.push({ field: 'dailyLimit', message: '每日上限建议不超过 10，太高容易触发平台风控' })
  void others
  return problems
}

/** Read the team configuration and health from the host. */
export async function fetchStatus(signal?: AbortSignal): Promise<ChannelsStatus> {
  const response = await fetch(`${ROUTE}/status`, { ...(signal === undefined ? {} : { signal }), headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`渠道服务返回 ${response.status}`)
  const payload = await response.json() as ChannelsStatus & { ok?: boolean; error?: string }
  if (payload.ok === false) throw new Error(payload.error ?? '渠道服务返回失败')
  return payload
}

/** Add or update one account in the team configuration. */
export async function saveAccount(
  channelId: string,
  channelName: string,
  draft: AccountDraft,
): Promise<HostResult> {
  const auth = draft.method === 'qr-login'
    ? { kind: 'browser-profile', profileDir: `~/.dsh/skills/sanwu-marketing-pipeline/.browser/${channelId}/${draft.id}` }
    : { kind: draft.method, secretRef: `env:SANWU_${channelId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_TOKEN` }
  const response = await fetch(`${ROUTE}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channel: channelId,
      channelName,
      op: 'upsert',
      account: {
        id: draft.id,
        label: draft.label,
        owner: draft.owner,
        persona: draft.persona,
        dailyLimit: draft.dailyLimit,
        enabled: true,
        auth,
      },
    }),
  })
  return await response.json() as HostResult
}

/** Remove one account from the team configuration. */
export async function removeAccount(channelId: string, accountId: string): Promise<HostResult> {
  const response = await fetch(`${ROUTE}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, op: 'remove', account: { id: accountId } }),
  })
  return await response.json() as HostResult
}

/** Open the platform login page in this account's own browser profile. */
export async function beginQrBinding(channelId: string, accountId: string): Promise<HostResult> {
  const response = await fetch(`${ROUTE}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel: channelId, account: accountId }),
  })
  return await response.json() as HostResult
}

/** Read whether the login finished. */
export async function readLoginStatus(
  channelId: string,
  accountId: string,
): Promise<{ bound: boolean; progress: LoginProgress | null }> {
  const response = await fetch(
    `${ROUTE}/login-status?channel=${encodeURIComponent(channelId)}&account=${encodeURIComponent(accountId)}`,
    { headers: { accept: 'application/json' } },
  )
  if (!response.ok) throw new Error(`渠道服务返回 ${response.status}`)
  const payload = await response.json() as { bound?: boolean; progress?: LoginProgress | null }
  return { bound: payload.bound === true, progress: payload.progress ?? null }
}
