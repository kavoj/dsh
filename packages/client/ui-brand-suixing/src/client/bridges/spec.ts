/**
 * The platform connection table — 一切接插件.
 *
 * Every capability in the directory is also a *socket*. It runs on this
 * machine with nothing configured, and it can be pointed at an HTTP endpoint
 * instead. Keeping that as data is what makes "connect the platform" a row in
 * a table rather than a change to any page: a different platform — the
 * company's own agent platform, a self-hosted one, or a single image service —
 * plugs in by publishing the same shape, and nothing in the client needs to
 * know which one answered.
 *
 * The socket shape is deliberately the smallest one that covers the platform's
 * open API: an origin, one path per capability, and a method. Per-capability
 * overrides live in the user's own configuration (see `store.ts`), so a
 * divergent endpoint never forces a code change here.
 *
 * Paths marked with a v1 endpoint come from the platform's open API doc
 * (`三五数字智能体平台-开放接口文档对外-v1.md`, base
 * `https://agent.35sz.top`, all calls under `/openapi/v1`): image, video, and
 * MV generation are real async-task endpoints, and the agents list is a real
 * read. PPT and workflows have no published v1 endpoint yet — their defaults
 * are reserved paths that answer 404 until the platform ships them, and the
 * settings page lets the user overwrite any of them today.
 */

import type { SuiXingBridgesKey } from './locales.ts'

/** What drives one capability: this machine, or an HTTP endpoint. */
export type BridgeMode = 'local' | 'platform'

/** Which business menu a socket belongs to. */
export type BridgeCentre = 'creation' | 'agents' | 'automation'

/** One capability's socket. */
export interface BridgeSpec {
  /** Stable id; the same id the directory capability uses. */
  readonly id: string
  /** The menu this socket sits in. */
  readonly centre: BridgeCentre
  /** Display name key, so a socket without copy is a compile error. */
  readonly labelKey: SuiXingBridgesKey
  /** Default path on the platform, relative to the configured origin. */
  readonly path: string
  /** The call's HTTP method. */
  readonly method: 'POST' | 'GET'
}

/** The platform origin offered as the placeholder in Settings. */
export const DEFAULT_PLATFORM_BASE = 'https://agent.35sz.top'

/** Every socket this distribution knows, in menu order. */
export const BRIDGES: readonly BridgeSpec[] = [
  // 创作中心 — one call per creation capability. Image and video are the
  // platform's real async-generation endpoints (submit → poll the task);
  // music is carried by the MV endpoint, and PPT has no v1 endpoint yet.
  { id: 'ppt', centre: 'creation', labelKey: 'bridge.ppt', path: '/openapi/v1/creator/ppt', method: 'POST' },
  { id: 'image', centre: 'creation', labelKey: 'bridge.image', path: '/openapi/v1/generations/image', method: 'POST' },
  { id: 'video', centre: 'creation', labelKey: 'bridge.video', path: '/openapi/v1/generations/video', method: 'POST' },
  { id: 'music', centre: 'creation', labelKey: 'bridge.music', path: '/openapi/v1/generations/mv', method: 'POST' },
  // The two centres' capability lists; read-only calls whose response shape is
  // the spec this distribution already renders (see the A2A design note).
  // The agents list is a real v1 endpoint; workflows have none published yet.
  { id: 'agents', centre: 'agents', labelKey: 'bridge.agents', path: '/openapi/v1/agents', method: 'GET' },
  { id: 'workflows', centre: 'automation', labelKey: 'bridge.workflows', path: '/openapi/v1/workflows', method: 'GET' },
]

/**
 * The sockets whose v1 platform call is the async-generation task pattern:
 * submit returns a `taskId`, and the result arrives by polling
 * `/openapi/v1/tasks/{taskId}`. Sockets outside this set either are plain
 * reads (agents) or have no published endpoint yet (ppt, workflows).
 */
export const TASK_SOCKETS: ReadonlySet<string> = new Set(['image', 'video', 'music'])

/** What the user configured for the sockets. */
export interface BridgeConfig {
  /** Platform origin; empty means every socket stays local. */
  readonly baseUrl: string
  /** Bearer credential the platform authenticates; empty until the user fills it. */
  readonly apiKey: string
  /** Per-socket choice; a socket absent here runs locally. */
  readonly modes: Readonly<Record<string, BridgeMode>>
  /** Per-socket endpoint override: a path or a full URL; empty means default. */
  readonly endpoints: Readonly<Record<string, string>>
}

/** How one socket currently stands. */
export type BridgeStatus =
  /** Runs on this machine; no configuration involved. */
  | 'local'
  /** Pointed at the platform and given an address. */
  | 'ready'
  /** Pointed at the platform but still missing its address. */
  | 'pending'

/** The configuration a fresh install starts from: everything local. */
export const EMPTY_BRIDGE_CONFIG: BridgeConfig = { baseUrl: '', apiKey: '', modes: {}, endpoints: {} }

/**
 * Find one socket by its capability id.
 * @param id - directory capability id.
 * @returns the socket, or undefined when the id has none.
 */
export function bridge(id: string): BridgeSpec | undefined {
  return BRIDGES.find(spec => spec.id === id)
}

/**
 * Whether a string is already a full URL rather than a path.
 * @param value - the configured endpoint value.
 * @returns whether the value carries its own scheme.
 */
function isAbsolute(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * The address one socket resolves to.
 *
 * An override wins over the table's default path, and an override that is
 * itself a full URL wins over the origin as well — so one capability can be
 * pointed at a different host without splitting the configuration.
 * @param config - the user's socket configuration.
 * @param spec - the socket being resolved.
 * @returns the resolved URL, or an empty string when the origin is unset.
 */
export function bridgeUrl(config: BridgeConfig, spec: BridgeSpec): string {
  const override = (config.endpoints[spec.id] ?? '').trim()
  if (isAbsolute(override)) return override
  const base = config.baseUrl.trim().replace(/\/+$/, '')
  if (base === '') return ''
  return `${base}${override === '' ? spec.path : normalizePath(override)}`
}

/**
 * Give an override path its leading slash, so `create-image` and
 * `/create-image` mean the same thing to the user.
 * @param path - the configured path.
 * @returns the path with exactly one leading slash.
 */
function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

/**
 * How one socket currently stands.
 * @param config - the user's socket configuration.
 * @param spec - the socket being read.
 * @returns the status the settings page and the directory badge show.
 */
export function bridgeStatus(config: BridgeConfig, spec: BridgeSpec): BridgeStatus {
  if ((config.modes[spec.id] ?? 'local') === 'local') return 'local'
  return bridgeUrl(config, spec) === '' ? 'pending' : 'ready'
}

/**
 * How many sockets are pointed at the platform.
 * @param config - the user's socket configuration.
 * @returns the count, for the settings summary line.
 */
export function platformCount(config: BridgeConfig): number {
  return BRIDGES.filter(spec => bridgeStatus(config, spec) !== 'local').length
}
