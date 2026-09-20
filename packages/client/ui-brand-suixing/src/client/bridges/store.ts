/**
 * The capability-connection configuration: one store behind the settings page,
 * the directory badge, and (later) the calls themselves.
 *
 * It is a separate store from the business centres on purpose. A centre answers
 * "which capabilities exist"; a connection answers "who runs this capability".
 * Keeping them apart is what lets the same agent list be read locally today and
 * from the platform tomorrow without the directory noticing.
 *
 * Defaults are the product decision 老谢 fixed: everything local, nothing
 * required. The platform origin and each endpoint are recorded as soon as the
 * user types them, so the platform rung stays a *reserved* configuration —
 * visible, editable, and inactive until chosen.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import { BRIDGES, type BridgeConfig, type BridgeMode } from './spec.ts'

/** The mutable state the store persists; `BridgeConfig` is its read-only view. */
interface BridgesState {
  /** Platform origin; empty means every socket stays local. */
  baseUrl: string
  /** Per-socket choice; a socket absent here runs locally. */
  modes: Record<string, BridgeMode>
  /** Per-socket endpoint override; empty means the table's default path. */
  endpoints: Record<string, string>
}

/** The connection configuration as every reader sees it. */
export type BridgesSnapshot = Readonly<BridgeConfig>

/** Where every reader finds a fresh install: everything local, no origin. */
const INITIAL_STATE: BridgesState = { baseUrl: '', modes: {}, endpoints: {} }

/** The connection configuration service. */
export interface BridgesService extends ObservableSnapshot<BridgesSnapshot> {
  /**
   * Record the platform origin.
   * @param url - the origin every un-overridden socket is resolved against.
   */
  setBaseUrl(url: string): void
  /**
   * Choose what drives one capability.
   * @param id - the capability's id.
   * @param mode - local, or the platform.
   */
  setMode(id: string, mode: BridgeMode): void
  /**
   * Record one capability's endpoint: a path, a full URL, or empty to clear it.
   * @param id - the capability's id.
   * @param endpoint - the override, or an empty string for the default path.
   */
  setEndpoint(id: string, endpoint: string): void
  /**
   * Point every known capability at one rung, in a single step.
   * @param mode - the rung to apply to all sockets.
   */
  setAllModes(mode: BridgeMode): void
}

/**
 * Create the connection configuration service.
 * @returns the service, persisted per browser.
 */
export function createBridgesService(): BridgesService {
  const store = createSnapshotStore<BridgesState>(
    INITIAL_STATE,
    { persist: { name: 'dsh.suixing.bridges' } },
  )
  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: listener => store.subscribe(listener),
    setBaseUrl: (baseUrl) => { store.update((draft) => { draft.baseUrl = baseUrl }) },
    setMode: (id, mode) => {
      store.update((draft) => { draft.modes = { ...draft.modes, [id]: mode } })
    },
    setEndpoint: (id, endpoint) => {
      store.update((draft) => { draft.endpoints = { ...draft.endpoints, [id]: endpoint } })
    },
    setAllModes: (mode) => {
      const modes: Record<string, BridgeMode> = {}
      for (const spec of BRIDGES) modes[spec.id] = mode
      store.update((draft) => { draft.modes = modes })
    },
  }
}
