/**
 * Platform error vocabulary.
 *
 * Codes and messages come from the SX-002 live probe. A code the map does not
 * know degrades to `unknown` instead of throwing, so a new platform code can
 * never break the bridge by surprise — it surfaces with its raw code and
 * message, which is what "errors must be locatable" (SX-006) requires.
 */

/** The platform's success code; every other code is a failure. */
export const PLATFORM_SUCCESS_CODE = 20000

/** Coarse failure classes the bridge maps platform codes onto. */
export type PlatformErrorKind =
  | 'invalid-request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'server-error'
  | 'unknown'

/** Observed platform codes mapped to their class. */
const KIND_BY_CODE: Readonly<Record<number, PlatformErrorKind>> = {
  40000: 'invalid-request',
  40100: 'unauthenticated',
  40200: 'unauthenticated',
  40300: 'forbidden',
  40400: 'not-found',
  40900: 'conflict',
  42900: 'rate-limited',
  50000: 'server-error',
}

/**
 * Classify a platform code.
 * @param code - the platform's numeric code.
 * @returns The matching class, or `unknown` for an unmapped code.
 */
export function platformErrorKind(code: number): PlatformErrorKind {
  return KIND_BY_CODE[code] ?? 'unknown'
}

/** What a platform failure carries for callers and logs. */
export interface PlatformErrorInit {
  readonly code: number
  readonly message: string
  readonly path: string
  readonly httpStatus: number
}

/**
 * One platform failure, carrying everything a caller needs to report it:
 * the platform code, its class, the request path, and the HTTP status.
 */
export class SuixingPlatformError extends Error {
  /** The platform's numeric code, or 0 when the payload was not an envelope. */
  readonly code: number
  /** The coarse class for {@link code}. */
  readonly kind: PlatformErrorKind
  /** The request path that failed. */
  readonly path: string
  /** The HTTP status the transport observed. */
  readonly httpStatus: number

  constructor(init: PlatformErrorInit) {
    super(`platform ${String(init.code)} ${init.message} (${init.path})`)
    this.name = 'SuixingPlatformError'
    this.code = init.code
    this.kind = platformErrorKind(init.code)
    this.path = init.path
    this.httpStatus = init.httpStatus
  }
}

/**
 * Whether a caught value is a platform failure.
 * @param value - the caught value.
 * @returns True when it is a {@link SuixingPlatformError}.
 */
export function isPlatformError(value: unknown): value is SuixingPlatformError {
  return value instanceof SuixingPlatformError
}
