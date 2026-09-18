/**
 * The simulated platform.
 *
 * It answers through {@link readEnvelope}, exactly like the live transport, so
 * a bridge client cannot tell the two apart — and a mistake in the shared
 * success/failure rules shows up against the mock without any network.
 */

import { readEnvelope } from './envelope.ts'
import { PLATFORM_FIXTURES } from './fixtures.ts'
import type { PlatformRequest, PlatformTransport } from './types.ts'

/** How the mock is configured. */
export interface MockTransportOptions {
  /** Fixture table, defaulting to the recorded payloads. */
  readonly fixtures?: Readonly<Record<string, unknown>>
  /** Clock for synthesised timestamps, injectable for deterministic tests. */
  readonly now?: () => number
}

/**
 * The fixture key for a call.
 * @param request - the call being answered.
 * @returns `"<METHOD> <path>"`.
 */
export function mockFixtureKey(request: PlatformRequest): string {
  return `${request.method} ${request.path}`
}

/**
 * Create the mock transport.
 * @param options - fixture overrides and clock.
 * @returns A transport answering from fixtures and reusing the shared envelope reader.
 */
export function createMockTransport(options: MockTransportOptions = {}): PlatformTransport {
  const fixtures = options.fixtures ?? PLATFORM_FIXTURES
  const now = options.now ?? ((): number => Date.now())
  return {
    async send(request: PlatformRequest): Promise<unknown> {
      const fixture = fixtures[mockFixtureKey(request)]
      if (fixture === undefined) {
        // Mirror the live platform's not-found envelope so the bridge's error
        // path is exercised identically against the mock.
        return readEnvelope({
          code: 40400,
          message: `Cannot ${request.method} ${request.path}`,
          data: null,
          timestamp: now(),
          path: request.path,
        }, request.path, 404)
      }
      return readEnvelope(fixture, request.path, 200)
    },
  }
}
