/**
 * Generic sidebar catalog groups.
 *
 * The shell renders every group the same way; titles, hints, entries, and load
 * status arrive from registrants through this service — locale dictionaries,
 * configuration, or service data. The base layout hardcodes no business name
 * and no entry, so a distribution composes its own catalog without editing the
 * sidebar. Recency and fold state are the shell's, persisted per browser.
 *
 * A registrant may mark a group `manageable`: the shell then offers rename and
 * delete on its header, seats a "new group" action under the stack, and folds
 * those titles into the conflict set. That is the same manage surface the
 * workspace browser already gives its projects — one browser-local view
 * preference, never an edit of the registrant's configuration, so unloading
 * the distribution leaves its own data untouched.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'

/**
 * Entries a group renders at once, both as recency and as a first-run
 * default. Sized to the largest shipped centre (AI参谋部's nine agents — the
 * approved prototype lists them all in the menu), so a distribution's full
 * roster fits without a second step; a centre may still exceed it, and then
 * its declared head shows with the view-all jump carrying the rest.
 */
export const CATALOG_VISIBLE_LIMIT = 9

/** Entry ids remembered across groups, most recent first. */
const RECENT_CAPACITY = 32

/** Id prefix of a group the user added from the sidebar. */
const USER_GROUP_PREFIX = 'user.'

/** Order of user-added groups: after every order a registrant declares. */
const USER_GROUP_ORDER = 1000

/** What activating one entry does. */
export type CatalogEntryTarget =
  | { readonly kind: 'panel'; readonly panelId: MainPanelId }
  | { readonly kind: 'command'; readonly run: () => void }

/** One row of a child row's trailing menu. */
export interface CatalogChildAction {
  /** Stable action id, dispatched back to the run below. */
  readonly id: string
  /** Already-localized menu text. */
  readonly label: string
  /** Render with the destructive treatment. */
  readonly danger?: boolean
  /** Perform the action; the row's own activation is not triggered. */
  readonly run: () => void
}

/**
 * One row a registrant nests under an entry.
 *
 * An entry is a capability; a child is something that capability produced and
 * that the user can walk back into — in this distribution, the conversations
 * it started. The shell renders them under their entry and knows nothing else
 * about them, so a registrant that never publishes children keeps the DOM it
 * had. A child that publishes `menu` also carries a trailing ellipsis control
 * (revealed on hover, the workspace browser's own row-menu treatment) whose
 * rows dispatch back to the registrant's runs.
 */
export interface CatalogChild {
  /** Stable identity; in this distribution the Session id. */
  readonly id: string
  /** Already-localized row text (normally the conversation's title). */
  readonly label: string
  /** Optional secondary line under the label. */
  readonly hint?: string
  /** Where activating this row lands. */
  readonly target: CatalogEntryTarget
  /** Working right now. */
  readonly running?: boolean
  /** Finished while the user was elsewhere and not yet opened. */
  readonly unread?: boolean
  /** This row stands for what is currently on screen. */
  readonly active?: boolean
  /** Optional trailing row menu (rename, remove, …). */
  readonly menu?: readonly CatalogChildAction[]
}

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
  /**
   * Rows nested under this entry, in render order. Empty or absent renders the
   * entry exactly as it rendered before children existed.
   */
  readonly children?: readonly CatalogChild[]
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
  /**
   * Whether the sidebar manages this group: header rename/delete, a seat in
   * the title-conflict set, and inclusion in the "new group" surface. Absent
   * means the group is fixed — only its registrant can change it.
   */
  readonly manageable?: boolean
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
  /**
   * Every entry id in the order this browser shows them — the full sequence
   * the visible slice is cut from. A centre's page reads it to display the
   * same arrangement its sidebar does and to drag against.
   */
  readonly ordered: readonly string[]
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
  /**
   * Whether any rendered group is manageable. The shell shows its "new group"
   * action only then, so a distribution that ships a fixed catalogue gets the
   * read-only region it always had.
   */
  readonly canManage: boolean
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
  /**
   * Perform one nested row's target.
   *
   * No recency is recorded: a child is a thing the entry already produced, so
   * visiting it must not promote the entry in the resting list — the entry is
   * already the row the child hangs from.
   * @param child - the activated nested row.
   */
  activateChild(child: CatalogChild): void
  /**
   * Rename a manageable group for this browser. A group the user added keeps
   * the new name as its own; a registrant's group keeps its published data and
   * gains a local title override.
   * @param groupId - group id.
   * @param title - the title the user chose.
   */
  renameGroup(groupId: string, title: string): void
  /**
   * Remove a group from this browser's sidebar. A group the user added is
   * dropped; a registrant's group is hidden, because its data is not the
   * sidebar's to delete.
   * @param groupId - group id.
   */
  removeGroup(groupId: string): void
  /**
   * Add a user group at the bottom of the stack. It starts empty: a platform
   * catalogue fills it once one can be addressed.
   * @param title - the name the user chose.
   * @returns the generated group id.
   */
  createGroup(title: string): string
  /**
   * Record the entry order the user dragged for one group. The saved sequence
   * replaces recency as that group's arrangement; ids the group stops
   * declaring are skipped, and entries it gains follow in declared order.
   * @param groupId - registered group id.
   * @param entryIds - the full entry sequence, in the user's order.
   */
  reorderEntries(groupId: string, entryIds: readonly string[]): void
  /** Re-run the registrant's retry action, when one is installed. */
  retry(): void
  /** Release every subscription this service installed. */
  dispose(): void
}

/** A group the user added from the sidebar, before any catalogue fills it. */
interface CatalogCustomGroup {
  /** Shell-assigned id; stable across reloads. */
  readonly id: string
  /** The name the user gave it. */
  readonly title: string
}

/**
 * Fold state, recency, and the user's own grouping: the slice the shell
 * persists per browser. The fields are mutable because the snapshot store's
 * `update` hands its draft back as this same type.
 */
interface CatalogProgress {
  /** Unfolded group ids; null means the user has not chosen yet. */
  expanded: readonly string[] | null
  /** Visited entry ids, most recent first. */
  recent: readonly string[]
  /** Registrant group id → the title this browser shows instead. */
  renamed: Record<string, string>
  /** Registrant group ids this browser hides. */
  removed: readonly string[]
  /** Groups the user added, in creation order. */
  created: readonly CatalogCustomGroup[]
  /**
   * Group id → the entry order the user dragged, as entry ids. An order the
   * user set is authoritative: recency stops re-sorting that group, so the
   * arrangement they made in the centre's page is the arrangement the sidebar
   * shows. Ids the group no longer declares are ignored; undeclared entries
   * follow in declared order.
   */
  ordered: Record<string, readonly string[]>
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
    { expanded: null, recent: [], renamed: {}, removed: [], created: [], ordered: {} },
    { persist: { name: 'dsh.sidebar.catalog' } },
  )
  /** Status and retry live off the persisted slice: a callback cannot serialize. */
  let status: CatalogStatus = 'ready'
  let retryAction: (() => void) | undefined
  let statusClaimed = false
  let sequence = 0

  // A registered group or a reported status is what puts the region on screen.
  // Both are released with the registrant, so unloading the distribution that
  // published a catalogue returns the sidebar to its unclaimed DOM. User-added
  // groups ride their registrant the same way: with no publisher there is no
  // region for them to live in, and their records wait for the next load.
  const isClaimed = (): boolean => statusClaimed || registrations.size > 0

  const listeners = new Set<() => void>()
  let cached: CatalogSnapshot = {
    claimed: false, status, groups: [], canRetry: false, canManage: false,
  }

  /** Republish the roster in `order` sequence, keeping ties in arrival order. */
  const publish = (): void => {
    order.set([...registrations.values()]
      .sort((left, right) => (left.group.order ?? 0) - (right.group.order ?? 0)
        || left.sequence - right.sequence))
  }

  /**
   * The groups this browser shows: every live registration the user has not
   * removed, titled by their rename when one exists, then the groups they
   * added themselves.
   */
  const visibleGroups = (): readonly CatalogGroup[] => {
    const { renamed, removed, created } = progress.getSnapshot()
    const published = order.getSnapshot()
      .filter(registration => !removed.includes(registration.group.id))
      .map((registration) => {
        const override = renamed[registration.group.id]
        return override === undefined ? registration.group : { ...registration.group, title: override }
      })
    return [
      ...published,
      ...created.map(custom => ({
        id: custom.id,
        order: USER_GROUP_ORDER,
        title: custom.title,
        entries: [],
        manageable: true,
      })),
    ]
  }

  const expandedIds = (): readonly string[] => {
    const { expanded } = progress.getSnapshot()
    if (expanded !== null) return expanded
    // First run: one center open, so the region is never a wall of headers.
    const first = visibleGroups()[0]
    return first === undefined ? [] : [first.id]
  }

  const view = (group: CatalogGroup, unfolded: readonly string[]): CatalogGroupView => {
    const entries = new Map(group.entries.map(entry => [entry.id, entry]))
    const { recent, ordered } = progress.getSnapshot()
    const saved = ordered[group.id]
    // The arrangement this group shows. Without a dragged order the recently
    // used entries float to the top and the declared head fills the rest, so
    // using one capability does not hide the ones nobody has opened yet (a
    // recency-only list would render a nine-agent centre as one row). With
    // one, the user's sequence is authoritative — recency stops re-sorting,
    // because an arrangement the user made must not shuffle itself back.
    const arranged = saved === undefined
      ? [...new Map([...recent.flatMap(id => entries.get(id) ?? []), ...group.entries]
        .map(entry => [entry.id, entry])).values()]
      : [...new Set(saved)].flatMap(id => entries.get(id) ?? [])
        .concat(group.entries.filter(entry => !saved.includes(entry.id)))
    return {
      group,
      visible: arranged.slice(0, CATALOG_VISIBLE_LIMIT),
      ordered: arranged.map(entry => entry.id),
      total: group.entries.length,
      expanded: unfolded.includes(group.id),
    }
  }

  const refresh = (): void => {
    const unfolded = expandedIds()
    const groups = visibleGroups()
    cached = {
      claimed: isClaimed(),
      status,
      groups: groups.map(group => view(group, unfolded)),
      canRetry: retryAction !== undefined,
      canManage: groups.some(group => group.manageable === true),
    }
    for (const listener of [...listeners]) listener()
  }

  const stops = [
    order.subscribe(refresh),
    progress.subscribe(refresh),
  ]

  /** First free user-group id, so a removed one never shadows a live group. */
  const nextUserGroupId = (): string => {
    const taken = new Set([
      ...registrations.keys(),
      ...progress.getSnapshot().created.map(custom => custom.id),
    ])
    let index = 1
    while (taken.has(`${USER_GROUP_PREFIX}${index}`)) index += 1
    return `${USER_GROUP_PREFIX}${index}`
  }

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
    activateChild: (child) => {
      if (child.target.kind === 'panel') selectPanel(child.target.panelId)
      else child.target.run()
    },
    renameGroup: (groupId, title) => {
      progress.update((draft) => {
        // A group the user added carries no published title, so the new name
        // is the record itself; a registrant's group gains an override.
        if (draft.created.some(custom => custom.id === groupId)) {
          draft.created = draft.created
            .map(custom => (custom.id === groupId ? { ...custom, title } : custom))
          return
        }
        draft.renamed = { ...draft.renamed, [groupId]: title }
      })
    },
    removeGroup: (groupId) => {
      progress.update((draft) => {
        if (draft.created.some(custom => custom.id === groupId)) {
          draft.created = draft.created.filter(custom => custom.id !== groupId)
          return
        }
        // Hidden, not deleted: the group's entries belong to its registrant,
        // and a later load of the same distribution may publish it again.
        if (draft.removed.includes(groupId)) return
        draft.removed = [...draft.removed, groupId]
      })
    },
    createGroup: (title) => {
      const id = nextUserGroupId()
      progress.update((draft) => {
        draft.created = [...draft.created, { id, title }]
      })
      return id
    },
    reorderEntries: (groupId, entryIds) => {
      progress.update((draft) => {
        draft.ordered = { ...draft.ordered, [groupId]: [...entryIds] }
      })
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
