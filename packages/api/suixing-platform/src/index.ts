/**
 * SuiXing platform bridge: the contract for agent.35sz.top.
 *
 * The bridge reads the platform's uniform envelope, classifies its error
 * codes, and offers one client that runs unchanged against the live HTTP
 * transport and the fixture-backed mock. Shapes and codes were captured by the
 * SX-002 probe; the SX-006 acceptance is that live and mock share this one
 * client interface, unknown fields stay forward-compatible, and a failure is
 * locatable from the error it throws.
 */

export * from './types.ts'
export * from './errors.ts'
export * from './envelope.ts'
export * from './http-transport.ts'
export * from './fixtures.ts'
export * from './mock-transport.ts'
export * from './client.ts'
