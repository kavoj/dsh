/**
 * Generic sidebar catalog groups.
 *
 * The shell renders every group the same way; titles, hints, entries, and load
 * status arrive from registrants through this service — locale dictionaries,
 * configuration, or service data. The base layout hardcodes no business name
 * and no entry, so a distribution composes its own catalog without editing the
 * sidebar. Recency and fold state are the shell's, persisted per browser.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'

/** Entries a group renders at once, both as recency and as a first-run default. */
export const CATALOG_VISIBLE_LIMIT = 5

/** Entry ids remembered across groups, most recent first. */
const RECENT_CAPACITY = 32

/** What activating one entry does. */
export type CatalogEntryTarget =
  | { readonly kind: 'panel'; readonly panelId: MainPanelId }
  | { readonly kind: 'command'; readonly run: () => void }

/** One capability a group offers. */
export interface CatalogEntry {
  /** Stable identity across reloads; recency is recorded against it. */
  readonly id: string
  /** Already-localized display text. */
  readonly label: string
  /** Optional one-line explanation under the label. */
  readonly hint?: string
  /** Where activating this entry lands. */
  readonly target: CatalogEntryTarget
}

/** One collapsible group of the sidebar catalog. */
export interface CatalogGroup {
  /** Stable identity across reloads; the fold state is recorded against it. */
  readonly id: string
  /** Ascending order; ties retain registration order. */
  readonly order?: number
  /** Already-localized group title. */
  readonly title: string
  /** Optional secondary name under the title (the plan's 辅助名称). */
  readonly hint?: string
  /** Declared capabilities. Unauthorized ones are simply not declared. */
  readonly entries: readonly CatalogEntry[]
  /** Main panel listing the group's full directory; enables "view all". */
  readonly allPanel?: MainPanelId
}

/**
 * Catalog load state, reported by the registrant that owns the data. `offline`
 * keeps the last known groups on screen instead of presenting a failed load as
 * an empty directory.
 */
export type CatalogStatus = 'loading' | 'ready' | 'offline' | 'error'

/** One group as the shell renders it. */
export interface CatalogGroupView {
  /** The registration this view was derived from. */
  readonly group: CatalogGroup
  /** Entries to render: recent first, capped, or the declared head on first run. */
  readonly visible: readonly CatalogEntry[]
  /** Declared entry count, for the "view all" label. */
  readonly total: number
  /** Whether the group is unfolded. */
  readonly expanded: boolean
}

/** Everything the shell renders in one frame. */
export interface CatalogSnapshot {
  /**
   * Whether any registrant has published a group or reported a status, and
   * still holds it. Unclaimed means the shell renders no region — and no
   * wrapper element — so a distribution that ships no catalog keeps the
   * sidebar's previous DOM byte for byte, and unloading one puts it back.
   */
  readonly claimed: boolean
  /** Load state reported by the owning registrant. */
  readonly status: CatalogStatus
  /** Registered groups, ordered; empty is a legitimate ready state. */
  readonly groups: readonly CatalogGroupView[]
  /** Whether a retry action is available for the current state. */
  readonly canRetry: boolean
}

/** The registrant-facing catalog service (ctx.sidebarCatalog). */
export interface ISidebarCatalog extends ObservableSnapshot<CatalogSnapshot> {
  /**
   * Publish one group, replacing any earlier registration with the same id.
   * @param group - the group descriptor (data, not a component).
   * @returns a disposer removing this registration.
   */
  register(group: CatalogGroup): () => void
  /**
   * Report the catalog's load state and, optionally, how to retry it.
   * @param status - the new state.
   * @param retry - retry action; omitted disables the retry affordance.
   */
  reportStatus(status: CatalogStatus, retry?: () => void): void
  /**
   * Fold or unfold one group, materializing the first-run default on the way.
   * @param groupId - registered group id.
   */
  toggleGroup(groupId: string): void
  /**
   * Set one group's fold state explicitly.
   * @param groupId - registered group id.
   * @param expanded - whether the group should render unfolded.
   */
  setGroupExpanded(groupId: string, expanded: boolean): void
  /**
   * Record the visit and perform the entry's target.
   * @param entry - the activated entry.
   */
  activate(entry: CatalogEntry): void
  /** Re-run the registrant's retry action, when one is installed. */
  retry(): void
  /** Release every subscription this service installed. */
  dispose(): void
}

/**
 * Fold state and recency: the slice the shell persists per browser. The fields
 * are mutable because the snapshot store's `update` hands its draft back as
 * this same type.
 */
interface CatalogProgress {
  /** Unfolded group ids; null means the user has not chosen yet. */
  expanded: readonly string[] | null
  /** Visited entry ids, most recent first. */
  recent: readonly string[]
}

/** A registration plus its arrival sequence, for stable ordering. */
interface CatalogRegistration {
  readonly group: CatalogGroup
  readonly sequence: number
}

/**
 * Create the catalog service the sidebar shell reads and registrants write.
 * @param selectPanel - panel selection used by entries targeting a main panel.
 * @returns the catalog service.
 */
export function createSidebarCatalog(
  selectPanel: (panelId: MainPanelId) => void,
): ISidebarCatalog {
  const registrations = new Map<string, CatalogRegistration>()
  const order = createSnapshotStore<readonly CatalogRegistration[]>([])
  const progress = createSnapshotStore<CatalogProgress>(
    { expanded: null, recent: [] },
    { persist: { name: 'dsh.sidebar.catalog' } },
  )
  /** Status and retry live off the persisted slice: a callback cannot serialize. */
  let status: CatalogStatus = 'ready'
  let retryAction: (() => void) | undefined
  let statusClaimed = false
  let sequence = 0

  // A registered group or a reported status is what puts the region on screen.
  // Both are released with the registrant, so unloading the distribution that
  // published a catalogue returns the sidebar to its unclaimed DOM.
  const isClaimed = (): boolean => statusClaimed || registrations.size > 0

  const listeners = new Set<() => void>()
  let cached: CatalogSnapshot = { claimed: false, status, groups: [], canRetry: false }

  const sorted = (): readonly CatalogRegistration[] => order.getSnapshot()

  /** Republish the roster in `order` sequence, keeping ties in arrival order. */
  const publish = (): void => {
    order.set([...registrations.values()]
      .sort((left, right) => (left.group.order ?? 0) - (right.group.order ?? 0)
        || left.sequence - right.sequence))
  }

  const expandedIds = (): readonly string[] => {
    const { expanded } = progress.getSnapshot()
    if (expanded !== null) return expanded
    // First run: one center open, so the region is never a wall of headers.
    const first = sorted()[0]
    return first === undefined ? [] : [first.group.id]
  }

  const view = (registration: CatalogRegistration, unfolded: readonly string[]): CatalogGroupView => {
    const { group } = registration
    const entries = new Map(group.entries.map(entry => [entry.id, entry]))
    const recent = progress.getSnapshot().recent
      .flatMap(id => entries.get(id) ?? [])
      .slice(0, CATALOG_VISIBLE_LIMIT)
    return {
      group,
      // Recency first; with none recorded yet, the declared head keeps the
      // group useful on a first visit instead of rendering it empty.
      visible: recent.length > 0 ? recent : group.entries.slice(0, CATALOG_VISIBLE_LIMIT),
      total: group.entries.length,
      expanded: unfolded.includes(group.id),
    }
  }

  const refresh = (): void => {
    const unfolded = expandedIds()
    cached = {
      claimed: isClaimed(),
      status,
      groups: sorted().map(registration => view(registration, unfolded)),
      canRetry: retryAction !== undefined,
    }
    for (const listener of [...listeners]) listener()
  }

  const stops = [
    order.subscribe(refresh),
    progress.subscribe(refresh),
  ]

  const service: ISidebarCatalog = {
    getSnapshot: () => cached,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    register: (group) => {
      registrations.set(group.id, { group, sequence })
      sequence += 1
      publish()
      return () => {
        if (registrations.get(group.id)?.group !== group) return
        registrations.delete(group.id)
        publish()
      }
    },
    reportStatus: (next, retry) => {
      statusClaimed = true
      status = next
      retryAction = retry
      refresh()
    },
    toggleGroup: (groupId) => {
      const unfolded = expandedIds()
      const next = unfolded.includes(groupId)
        ? unfolded.filter(id => id !== groupId)
        : [...unfolded, groupId]
      progress.update((draft) => { draft.expanded = next })
    },
    setGroupExpanded: (groupId, isExpanded) => {
      const unfolded = expandedIds()
      const next = isExpanded
        ? unfolded.includes(groupId) ? unfolded : [...unfolded, groupId]
        : unfolded.filter(id => id !== groupId)
      progress.update((draft) => { draft.expanded = next })
    },
    activate: (entry) => {
      progress.update((draft) => {
        draft.recent = [entry.id, ...draft.recent.filter(id => id !== entry.id)]
          .slice(0, RECENT_CAPACITY)
      })
      if (entry.target.kind === 'panel') selectPanel(entry.target.panelId)
      else entry.target.run()
    },
    retry: () => { retryAction?.() },
    dispose: () => {
      for (const stop of stops) stop()
      listeners.clear()
    },
  }
  refresh()
  return service
}
