/**
 * Envelope reading shared by both transports.
 *
 * The real HTTP transport and the mock both hand their raw payload to
 * {@link readEnvelope}, so "what counts as success" and "how a failure is
 * reported" cannot drift between live and simulated platforms.
 */

import { PLATFORM_SUCCESS_CODE, SuixingPlatformError } from './errors.ts'
import type { PlatformEnvelope } from './types.ts'

/**
 * Whether a value carries a platform envelope's discriminant.
 * @param value - the parsed payload.
 * @returns True when the value is an object with a numeric `code`.
 */
export function isPlatformEnvelope(value: unknown): value is PlatformEnvelope<unknown> {
  if (value === null || typeof value !== 'object') return false
  return typeof (value as { readonly code?: unknown }).code === 'number'
}

/**
 * Unwrap an envelope, or throw the failure it describes.
 *
 * A payload that is not an envelope is itself an error: the platform serves
 * its SPA for unknown paths, so HTML arriving where JSON was expected is a
 * routing mistake worth naming rather than a silent `undefined`.
 * @param raw - the parsed payload.
 * @param path - the request path, for the error record.
 * @param httpStatus - the HTTP status the transport observed.
 * @returns The envelope's `data` when the code is the success code.
 */
export function readEnvelope(raw: unknown, path: string, httpStatus: number): unknown {
  if (!isPlatformEnvelope(raw)) {
    throw new SuixingPlatformError({
      code: 0,
      message: 'the platform returned a payload without a numeric code',
      path,
      httpStatus,
    })
  }
  if (raw.code === PLATFORM_SUCCESS_CODE) return raw.data
  throw new SuixingPlatformError({
    code: raw.code,
    message: typeof raw.message === 'string' ? raw.message : 'the platform returned no message',
    path,
    httpStatus,
  })
}
