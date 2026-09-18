/**
 * The live HTTP transport for agent.35sz.top.
 *
 * It owns exactly three things the mock does not need: URL assembly, the
 * bearer header, and JSON parsing. Everything after parsing goes through
 * {@link readEnvelope}, the same function the mock uses.
 */

import { readEnvelope } from './envelope.ts'
import type { PlatformRequest, PlatformTransport } from './types.ts'

/** What the live transport needs to reach the platform. */
export interface HttpTransportOptions {
  /** Origin, with or without a trailing slash. */
  readonly baseUrl: string
  /** Fetch implementation, injectable for tests. */
  readonly fetchImpl?: typeof fetch
}

/**
 * Join an origin, a path, and a query into a request URL.
 * @param baseUrl - the platform origin.
 * @param request - the call to address.
 * @returns The absolute URL.
 */
export function buildPlatformUrl(baseUrl: string, request: PlatformRequest): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const url = `${base}${request.path}`
  const query = request.query
  if (query === undefined) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    params.set(key, String(value))
  }
  const search = params.toString()
  return search === '' ? url : `${url}?${search}`
}

/**
 * Create the live transport.
 * @param options - origin and optional fetch override.
 * @returns A transport that unwraps envelopes and throws platform failures.
 */
export function createHttpTransport(options: HttpTransportOptions): PlatformTransport {
  const doFetch = options.fetchImpl ?? fetch
  return {
    async send(request: PlatformRequest): Promise<unknown> {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const token = request.token
      if (token !== undefined && token !== '') headers.Authorization = `Bearer ${token}`
      const init: RequestInit = { method: request.method, headers }
      if (request.body !== undefined) init.body = JSON.stringify(request.body)
      const response = await doFetch(buildPlatformUrl(options.baseUrl, request), init)
      const text = await response.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = undefined
      }
      return readEnvelope(parsed, request.path, response.status)
    },
  }
}
