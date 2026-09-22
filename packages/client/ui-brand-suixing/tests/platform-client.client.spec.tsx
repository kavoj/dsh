// @vitest-environment jsdom
/**
 * The platform open API client — the call side of 一切接插件, against a stubbed
 * fetch. The facts under test are the v1 contract's load-bearing ones: success
 * is HTTP 200 with a `{ data }` envelope (no code field), failure is 4xx/5xx
 * with `{ error: { code } }`, and generation is a submit-then-poll task whose
 * pacing, timeout, cancellation, and failure exits are all the client's own.
 */
import { describe, expect, it } from 'vitest'
import {
  createPlatformClient, type PlatformCallConfig,
} from '../src/client/bridges/client.ts'

const CONFIG: PlatformCallConfig = { url: 'https://agent.35sz.top/openapi/v1/generations/image', apiKey: 'sk-test-1' }

/** One JSON response, as the platform would send it. */
function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

/**
 * A stubbed fetch that records every call as `METHOD url` and answers with the
 * handler's response; the recorded list is what most assertions read.
 */
function fetchOf(
  handler: (url: string, init: RequestInit | undefined) => Response,
): { fetch: typeof fetch; calls: string[] } {
  const calls: string[] = []
  const impl = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    return Promise.resolve(handler(url, init))
  }
  return { fetch: impl, calls }
}

describe('platform client — the request', () => {
  it('sends the Bearer key and unwraps the 200 data envelope', async () => {
    const { fetch, calls } = fetchOf(() => json(200, { message: 'success', data: { taskId: 't_1' }, requestId: 'req_1' }))
    const client = createPlatformClient(fetch)
    const outcome = await client.request(CONFIG, 'POST', { prompt: 'x' })
    expect(outcome).toEqual({ ok: true, data: { taskId: 't_1' } })
    expect(calls).toEqual(['POST https://agent.35sz.top/openapi/v1/generations/image'])
  })

  it('sends the Authorization header from the configured key', async () => {
    let seen: string | undefined
    const { fetch } = fetchOf((_url, init) => {
      seen = (init?.headers as Record<string, string>).Authorization
      return json(200, { data: {} })
    })
    const client = createPlatformClient(fetch)
    await client.request(CONFIG, 'POST', {})
    expect(seen).toBe('Bearer sk-test-1')
  })

  it('omits the Authorization header when no key is configured', async () => {
    let seen: string | undefined
    const { fetch } = fetchOf((_url, init) => {
      seen = (init?.headers as Record<string, string>).Authorization
      return json(200, { data: {} })
    })
    const client = createPlatformClient(fetch)
    const outcome = await client.request({ ...CONFIG, apiKey: '' }, 'GET')
    expect(outcome.ok).toBe(true)
    expect(seen).toBeUndefined()
  })

  it('maps a business failure to its code, detail, and requestId', async () => {
    const { fetch } = fetchOf(() => json(402, {
      message: '积分不足',
      error: { code: 'INSUFFICIENT_CREDITS', detail: '积分不足' },
      requestId: 'req_9',
      data: { balance: 10, need: 100 },
    }))
    const client = createPlatformClient(fetch)
    const outcome = await client.request(CONFIG, 'POST', {})
    expect(outcome).toMatchObject({
      ok: false,
      failure: { code: 'INSUFFICIENT_CREDITS', requestId: 'req_9', balance: 10, need: 100 },
    })
  })

  it('reads Retry-After on a rate limit and falls back for an opaque body', async () => {
    const { fetch } = fetchOf(() => new Response('gateway timeout', {
      status: 504, headers: { 'Retry-After': '7' },
    }))
    const client = createPlatformClient(fetch)
    const outcome = await client.request(CONFIG, 'POST', {})
    expect(outcome).toMatchObject({
      ok: false,
      failure: { code: 'HTTP_504', retryAfterSeconds: 7 },
    })
  })

  it('reports an unreachable platform as a NETWORK failure, not a throw', async () => {
    const { fetch } = fetchOf(() => { throw new TypeError('fetch failed') })
    const client = createPlatformClient(fetch)
    const outcome = await client.request(CONFIG, 'POST', {})
    expect(outcome).toMatchObject({ ok: false, failure: { code: 'NETWORK', message: 'fetch failed' } })
  })
})

describe('platform client — the task run', () => {
  it('submits, polls to success, and polls the v1 task endpoint', async () => {
    let poll = 0
    const { fetch, calls } = fetchOf((_url, init) => {
      if ((init?.method ?? 'GET') === 'POST') return json(200, { data: { taskId: 't_9', status: 'pending' } })
      poll += 1
      if (poll === 1) return json(200, { data: { taskId: 't_9', status: 'running' } })
      return json(200, { data: { taskId: 't_9', status: 'succeeded', result: { images: [{ url: 'a.png' }], cost: 5 } } })
    })
    const client = createPlatformClient(fetch)
    const seen: string[] = []
    const outcome = await client.runTask(CONFIG, { prompt: 'x' }, {
      intervalMs: 1, onStatus: task => seen.push(task.status),
    })
    expect(outcome).toEqual({
      ok: true,
      data: { taskId: 't_9', type: undefined, status: 'succeeded', result: { images: [{ url: 'a.png' }], cost: 5 }, error: '' },
    })
    expect(seen).toEqual(['running', 'succeeded'])
    expect(calls[0]).toBe('POST https://agent.35sz.top/openapi/v1/generations/image')
    expect(calls[1]).toBe('GET https://agent.35sz.top/openapi/v1/tasks/t_9')
  })

  it('exits with the task\'s failure reason when the platform says failed', async () => {
    const { fetch } = fetchOf((_url, init) => {
      if ((init?.method ?? 'GET') === 'POST') return json(200, { data: { taskId: 't_2' } })
      return json(200, { data: { taskId: 't_2', status: 'failed', error: 'NSFW blocked' } })
    })
    const client = createPlatformClient(fetch)
    const outcome = await client.runTask(CONFIG, {}, { intervalMs: 1 })
    expect(outcome).toMatchObject({
      ok: false,
      failure: { code: 'TASK_FAILED', message: 'NSFW blocked' },
    })
  })

  it('gives up after the timeout while the task keeps running', async () => {
    const { fetch } = fetchOf((_url, init) => {
      if ((init?.method ?? 'GET') === 'POST') return json(200, { data: { taskId: 't_3' } })
      return json(200, { data: { taskId: 't_3', status: 'running' } })
    })
    const client = createPlatformClient(fetch)
    const outcome = await client.runTask(CONFIG, {}, { intervalMs: 1, timeoutMs: 30 })
    expect(outcome).toMatchObject({ ok: false, failure: { code: 'POLL_TIMEOUT' } })
  })

  it('aborts promptly when the caller cancels the run', async () => {
    const { fetch, calls } = fetchOf(() => json(200, { data: { taskId: 't_4' } }))
    const client = createPlatformClient(fetch)
    const controller = new AbortController()
    const run = client.runTask(CONFIG, {}, { intervalMs: 60_000, signal: controller.signal })
    controller.abort()
    const outcome = await run
    // The aborted sleep exits the loop before any poll left the client.
    expect(outcome).toMatchObject({ ok: false, failure: { code: 'ABORTED' } })
    expect(calls).toHaveLength(1)
  })

  it('refuses a submit that returns no task id', async () => {
    const { fetch } = fetchOf(() => json(200, { data: { weird: true } }))
    const client = createPlatformClient(fetch)
    const outcome = await client.runTask(CONFIG, {}, { intervalMs: 1 })
    expect(outcome).toMatchObject({ ok: false, failure: { code: 'MALFORMED_TASK' } })
  })
})
