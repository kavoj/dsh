/**
 * The platform open API client — the call side of 一切接插件.
 *
 * The connection table (see `spec.ts`) answers "where does this capability
 * run"; this module answers "what happens when it runs there". It speaks the
 * platform's open API v1 conventions only: a Bearer key, an envelope where
 * success is HTTP 200 with `{ data }` and failure is 4xx/5xx with
 * `{ error: { code, detail } }` plus a `requestId`, and long-running
 * generations that return a `taskId` to poll at `/openapi/v1/tasks/{id}`.
 *
 * Everything is plain `fetch` with the implementation injectable, and the
 * outcomes are values rather than exceptions — a bridge call that fails is a
 * business fact the UI renders, not a crash. Error copy lives in the locales;
 * this layer carries the machine facts (code, retry-after, balance numbers)
 * the copy needs.
 */

/** Where and as-whom one platform call is made. */
export interface PlatformCallConfig {
  /** The resolved absolute URL (see `bridgeUrl`). */
  readonly url: string
  /** The Bearer credential; empty sends no Authorization header. */
  readonly apiKey: string
}

/** Why one platform call failed, in machine facts. */
export interface PlatformFailure {
  /** The platform's business error code, e.g. `INSUFFICIENT_CREDITS`. */
  readonly code: string
  /** The platform's human-readable message, when it sent one. */
  readonly message: string
  /** The platform's correlation id, for support requests. */
  readonly requestId: string | undefined
  /** Seconds to wait, from `Retry-After`, when the platform sent one. */
  readonly retryAfterSeconds: number | undefined
  /** Balance facts, present when the code is `INSUFFICIENT_CREDITS`. */
  readonly balance: number | undefined
  readonly need: number | undefined
}

/** One platform outcome: a value, or the failure the UI renders. */
export type PlatformOutcome<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly failure: PlatformFailure }

/** One task's state, as the platform's task endpoint reports it. */
export interface PlatformTask {
  readonly taskId: string
  readonly type: string | undefined
  readonly status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'
  readonly result: unknown
  readonly error: PlatformFailure['message']
}

/** How `runTask` paces and bounds its polling. */
export interface RunTaskOptions {
  /** Milliseconds between polls; the platform asks for ≥ 3 seconds. */
  readonly intervalMs?: number
  /** Milliseconds before polling gives up (the task may still finish later). */
  readonly timeoutMs?: number
  /** Progress tap: every intermediate task state passes through here. */
  readonly onStatus?: (task: PlatformTask) => void
  /** Cancellation for the whole run, including the in-flight poll. */
  readonly signal?: AbortSignal
}

/** The JSON body of an unexpected payload, when one can be read at all. */
interface ErrorBody {
  message?: unknown
  error?: unknown
  requestId?: unknown
  data?: { need?: unknown; balance?: unknown } | null
}

/**
 * Create the platform client.
 * @param fetchImpl - the fetch implementation; defaults to the ambient one.
 * @returns the client's two operations: a single request, and a full
 *   submit-and-poll task run.
 */
export function createPlatformClient(
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): {
  request(config: PlatformCallConfig, method: 'GET' | 'POST', body?: unknown): Promise<PlatformOutcome<unknown>>
  runTask(config: PlatformCallConfig, body: unknown, options?: RunTaskOptions): Promise<PlatformOutcome<PlatformTask>>
} {
  const request = async (
    config: PlatformCallConfig, method: 'GET' | 'POST', body?: unknown,
  ): Promise<PlatformOutcome<unknown>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
    if (config.apiKey !== '') headers.Authorization = `Bearer ${config.apiKey}`
    let response: Response
    try {
      response = await fetchImpl(config.url, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch (reason: unknown) {
      return { ok: false, failure: networkFailure(reason) }
    }
    if (response.status === 200) {
      const payload = await readJson(response)
      // The envelope is `{ data }`; a 200 without one still counts as success
      // so a bare response body never reads as a failure.
      return { ok: true, data: payload === undefined ? undefined : (payload as { data?: unknown }).data }
    }
    return { ok: false, failure: await failureOf(response) }
  }

  const taskOnce = async (config: PlatformCallConfig, taskId: string): Promise<PlatformOutcome<PlatformTask>> => {
    const outcome = await request(config, 'GET')
    if (!outcome.ok) return outcome
    const raw = outcome.data as { taskId?: unknown; type?: unknown; status?: unknown; result?: unknown; error?: unknown } | undefined
    if (raw === undefined || typeof raw !== 'object') {
      return { ok: false, failure: { code: 'MALFORMED_TASK', message: '', requestId: undefined, retryAfterSeconds: undefined, balance: undefined, need: undefined } }
    }
    return {
      ok: true,
      data: {
        taskId: typeof raw.taskId === 'string' ? raw.taskId : taskId,
        type: typeof raw.type === 'string' ? raw.type : undefined,
        status: normalizeStatus(raw.status),
        result: raw.result,
        error: typeof raw.error === 'string' ? raw.error : '',
      },
    }
  }

  const runTask = async (
    config: PlatformCallConfig, body: unknown, options: RunTaskOptions = {},
  ): Promise<PlatformOutcome<PlatformTask>> => {
    const intervalMs = options.intervalMs ?? 3_000
    const timeoutMs = options.timeoutMs ?? 10 * 60_000
    const submitted = await request(config, 'POST', body)
    if (!submitted.ok) return submitted
    const taskId = (submitted.data as { taskId?: unknown } | undefined)?.taskId
    if (typeof taskId !== 'string' || taskId === '') {
      return { ok: false, failure: { code: 'MALFORMED_TASK', message: '', requestId: undefined, retryAfterSeconds: undefined, balance: undefined, need: undefined } }
    }
    const pollUrl = taskUrl(config.url, taskId)
    const deadline = Date.now() + timeoutMs
    for (;;) {
      await sleep(intervalMs, options.signal)
      if (options.signal?.aborted === true) {
        return { ok: false, failure: { code: 'ABORTED', message: '', requestId: undefined, retryAfterSeconds: undefined, balance: undefined, need: undefined } }
      }
      if (Date.now() > deadline) {
        return { ok: false, failure: { code: 'POLL_TIMEOUT', message: '', requestId: undefined, retryAfterSeconds: undefined, balance: undefined, need: undefined } }
      }
      const snapshot = await taskOnce({ ...config, url: pollUrl }, taskId)
      if (!snapshot.ok) return snapshot
      options.onStatus?.(snapshot.data)
      if (snapshot.data.status === 'succeeded') return snapshot
      if (snapshot.data.status === 'failed' || snapshot.data.status === 'canceled') {
        return { ok: false, failure: {
          code: snapshot.data.status === 'failed' ? 'TASK_FAILED' : 'TASK_CANCELED',
          message: snapshot.data.error,
          requestId: undefined, retryAfterSeconds: undefined, balance: undefined, need: undefined,
        } }
      }
    }
  }

  return { request, runTask }
}

/**
 * Map the platform's status spellings onto the task state machine, so an
 * unknown value degrades to "still working" instead of an early exit.
 */
function normalizeStatus(value: unknown): PlatformTask['status'] {
  return value === 'succeeded' || value === 'failed' || value === 'canceled'
    ? value
    : value === 'pending' ? 'pending' : 'running'
}

/**
 * The task endpoint of a submitted generation: same origin, `/openapi/v1/tasks/{id}`.
 * A standard v1 generation URL has its `/generations/{kind}` tail replaced; any
 * other shape (a user's custom endpoint) falls back to the origin-rooted path.
 * @param submittedUrl - the URL the task was submitted to.
 * @param taskId - the id the platform returned.
 * @returns the URL to poll.
 */
function taskUrl(submittedUrl: string, taskId: string): string {
  if (/\/generations\/[^/]+$/.test(submittedUrl)) {
    return submittedUrl.replace(/\/generations\/[^/]+$/, `/tasks/${taskId}`)
  }
  try {
    return `${new URL(submittedUrl).origin}/openapi/v1/tasks/${taskId}`
  } catch {
    return submittedUrl
  }
}

/** Give a rejected fetch its one business meaning: the platform is unreachable. */
function networkFailure(reason: unknown): PlatformFailure {
  return {
    code: 'NETWORK',
    message: reason instanceof Error ? reason.message : String(reason),
    requestId: undefined, retryAfterSeconds: undefined, balance: undefined, need: undefined,
  }
}

/** Read a response body as JSON, tolerating an empty or non-JSON body. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

/** Collect one failed response's machine facts into a `PlatformFailure`. */
async function failureOf(response: Response): Promise<PlatformFailure> {
  const body = await readJson(response) as ErrorBody | undefined
  const error = (body !== undefined && typeof body === 'object' && body.error !== null && typeof body.error === 'object')
    ? body.error as { code?: unknown; detail?: unknown }
    : undefined
  const code = typeof error?.code === 'string' ? error.code
    : response.status === 429 ? 'RATE_LIMITED' : `HTTP_${response.status}`
  const retryAfter = response.headers.get('Retry-After')
  const seconds = retryAfter === null ? undefined : Number(retryAfter)
  return {
    code,
    message: typeof error?.detail === 'string' && error.detail !== '' ? error.detail
      : typeof body?.message === 'string' ? body.message : '',
    requestId: typeof body?.requestId === 'string' ? body.requestId : undefined,
    retryAfterSeconds: seconds !== undefined && Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined,
    balance: numberOf(body?.data?.balance),
    need: numberOf(body?.data?.need),
  }
}

/** Read one optional number field, tolerating strings the platform may send. */
function numberOf(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

/** A sleep that an abort signal cuts short, so cancellation is prompt. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted === true) {
      resolve()
      return
    }
    const timer = setTimeout(done, ms)
    function done(): void {
      signal?.removeEventListener('abort', done)
      clearTimeout(timer)
      resolve()
    }
    signal?.addEventListener('abort', done)
  })
}
