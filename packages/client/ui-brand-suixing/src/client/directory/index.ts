/**
 * Publish the SuiXing capability directory.
 *
 * The business menus of the plan's §2.1 decision arrive here as data: a catalog
 * group the sidebar shell renders generically, a main panel its "view all"
 * opens, and the page definitions those panels show. Nothing about the menus
 * reaches the base layout, so a build that never calls this adds no sidebar DOM
 * at all.
 *
 * The group data is a *projection of three sources*: the shipped spec, the
 * capabilities the user built from a sentence in Settings, and the
 * conversations those capabilities started. The catalogue is rebuilt whenever
 * any of them moves, which is what makes "draft an agent" and "see it in the
 * menu" one step for the user rather than a sync problem. A shipped group keeps
 * its entries; the local ones append after them, and a capability's
 * conversations hang under whichever entry claimed them.
 *
 * Activating an entry is the same navigation as opening a card: it writes the
 * focused capability and selects the menu's panel. The sidebar therefore lands
 * on the capability itself, and the panel's list is one step back — the
 * prototype's behaviour, expressed as data the shell already knows how to run.
 *
 * Starting work from that page is the one action that creates something: a real
 * Session, recorded against the capability so the sidebar can nest it and the
 * conversation panel can render it. Nothing about the Session is special, which
 * is deliberate — history, search, archive, and the workspace browser all keep
 * working because it is the entity they already know.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { CatalogChild, CatalogGroup } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { BridgesService } from '../bridges/store.ts'
import type { CentersService, CentersSnapshot } from '../centers/store.ts'
import { registerSuiXingReferences } from '../references/index.ts'
import { createRolePresets } from '../presets/index.ts'
import { createThreadLauncher } from '../threads/launcher.ts'
import { threadRows, type ThreadSummary } from '../threads/spec.ts'
import type { ThreadsService } from '../threads/store.ts'
import { localCapabilities } from './capabilities.ts'
import { DirectoryPage } from './DirectoryPage.tsx'
import { createDirectoryFocus, type DirectoryFocus } from './focus.ts'
import { DIRECTORY_NS, directoryEn, directoryZh, type SuiXingDirectoryKey } from './locales.ts'
import {
  CREATION_PANEL, DIRECTORY_GROUPS, directoryGroup, type DirectoryGroupSpec,
} from './specs.ts'

export { CapabilityDetail, type CapabilityDetailProps, type DetailConnection, type DetailTarget } from './CapabilityDetail.tsx'
export { DirectoryPage, type DirectoryPageProps } from './DirectoryPage.tsx'
export { createDirectoryFocus, type DirectoryFocus } from './focus.ts'
export { localCapabilities, type LocalCapability } from './capabilities.ts'
export { DIRECTORY_NS, directoryEn, directoryZh, type SuiXingDirectoryKey } from './locales.ts'
export {
  AGENTS_PANEL, AUTOMATION_PANEL, PROJECTS_PANEL, CREATION_PANEL,
  AGENT_IDS, CREATION_IDS, WORKFLOW_IDS, PROJECT_IDS, DIRECTORY_GROUPS, directoryGroup,
  type AgentId, type CreationId, type ProjectId, type WorkflowId,
  type CapabilityField, type CapabilitySpec, type DirectoryGroupSpec,
} from './specs.ts'

/** The rows one capability's conversations are, as the sidebar takes them. */
type ThreadChildren = ReadonlyMap<string, readonly CatalogChild[]>

/** The Session facts the nested rows are projected from. */
interface SessionFacts {
  readonly summaries: Readonly<Record<string, ThreadSummary | undefined>>
  readonly current: string | undefined
}

/**
 * Project one group descriptor plus the local capabilities onto the catalog
 * shape the sidebar renders.
 * @param group - the shipped group descriptor.
 * @param snapshot - the current business-centre configuration.
 * @param t - directory translate seat.
 * @param children - conversations by capability id; a capability with none
 *   renders exactly as it did before conversations existed.
 * @param openEntry - performs the navigation an activated entry asks for.
 * @returns the group as the sidebar takes it.
 */
function catalogGroup(
  group: DirectoryGroupSpec, snapshot: CentersSnapshot, t: Translate<SuiXingDirectoryKey>,
  children: ThreadChildren, openEntry: (entryId: string) => void,
): CatalogGroup {
  const entry = (id: string, label: string, hint: string) => ({
    id,
    label,
    hint,
    // Opening an entry lands on the capability itself: the focused id is what
    // the menu's panel reads, so one navigation serves the entry and the card.
    target: { kind: 'command' as const, run: () => { openEntry(id) } },
    children: children.get(id) ?? [],
  })
  return {
    id: group.id,
    order: group.order,
    title: t(group.titleKey),
    hint: t(group.hintKey),
    allPanel: group.panelId,
    // The sidebar may rename, remove, and add around these centres: the plan
    // treats them as the user's own business areas. The choices stay
    // browser-local, so nothing here is edited from the client.
    manageable: group.manageable,
    entries: [
      ...group.entries.map(capability =>
        entry(capability.id, t(capability.labelKey), t(capability.hintKey))),
      ...localCapabilities(group, snapshot).map(local =>
        entry(local.id, local.name, local.hint)),
    ],
  }
}

/**
 * A fingerprint of the nested rows alone.
 *
 * The session list moves constantly while a turn streams, and four group
 * registrations per notification is work nobody asked for. The rows are the
 * only part of the catalogue that arrives that way, so an unchanged
 * fingerprint is a publish skipped.
 * @param children - conversations by capability id.
 * @returns the fingerprint.
 */
function childrenSignature(children: ThreadChildren): string {
  return JSON.stringify([...children].map(([capabilityId, rows]) => [capabilityId,
    rows.map(row => [row.id, row.label, row.running === true, row.active === true])]))
}

/** Panel keys the connection badge is meaningful on. */
const BRIDGED_PANELS = new Set<string>([CREATION_PANEL])

/**
 * Register the directory's dictionaries, groups, and panels.
 * @param ctx - Client root context carrying the catalog, slot, locale, and layout services.
 * @param centers - the business-centre configuration the local entries come from.
 * @param bridges - the capability-connection configuration the pages read.
 * @param threads - the conversations capabilities started, which nest under them.
 * @returns the focus service, so a caller that already shows a capability can drive it.
 */
export function registerSuiXingDirectory(
  ctx: ClientContext, centers: CentersService, bridges: BridgesService, threads: ThreadsService,
): DirectoryFocus {
  ctx.effect(
    () => ctx.locale.register(DIRECTORY_NS, { zh: directoryZh, en: directoryEn }),
    'ui-brand-suixing: directory dictionaries',
  )
  const t = ctx.locale.bind(DIRECTORY_NS)
  const focus = createDirectoryFocus()
  const launcher = createThreadLauncher(ctx, threads, createRolePresets(ctx))
  // One navigation, two writers: the sidebar entry and the card both say "show
  // this capability", and the panel that renders it is the menu's own.
  const openEntry = (panelId: MainPanelId, entryId: string): void => {
    focus.focus(entryId)
    ctx.layout.selectPanel(panelId)
  }
  // "开始对话" starts a conversation of the capability's own. A build without
  // the session services falls back to the shell's own panel selection, which
  // is the closest thing it has to a new chat, rather than a dead control.
  const startCapability = (id: string): void => {
    if (launcher.available) launcher.start(id)
    else ctx.layout.selectPanel(null)
  }
  // Any conversation may name any capability: the `@` menu offers every entry
  // of every menu, and picking one opens the same page a card opens.
  registerSuiXingReferences(ctx, centers, (groupId, id) => {
    const group = directoryGroup(groupId)
    /* v8 ignore next -- ids are minted from the groups this distribution publishes. */
    if (group === undefined) return
    openEntry(group.panelId, id)
  })
  // The panels are keyed slots registered once: their content follows the
  // stores through bound hooks instead, so a new agent shows up in "view all"
  // and a new connection shows up on its badge without re-registering a
  // component.
  for (const group of DIRECTORY_GROUPS) {
    ctx.slots.inject('main', () => ctx.slots.register({
      name: 'main',
      key: group.panelId,
      locale: DIRECTORY_NS,
      inject: () => ({
        group,
        hooks: BRIDGED_PANELS.has(group.panelId)
          ? { centers, bridges, focus }
          : { centers, focus },
        focusCapability: (id: string) => { focus.focus(id) },
        clearFocus: () => { focus.clear() },
        startCapability: (id: string) => { startCapability(id) },
      }),
    }, DirectoryPage))
  }
  // The sidebar takes plain data, so the catalogue is re-published whenever the
  // centres move, a conversation is bound, or the session list changes — the
  // three inputs the rows are projected from. Each registration replaces its
  // predecessor by id, and the effect's disposer releases the last set.
  ctx.effect(() => {
    const sessions = ctx.get('sessions')
    let disposers: readonly (() => void)[] = []
    let signature = ''

    const sessionFacts = (): SessionFacts => {
      if (sessions === undefined) return { summaries: {}, current: undefined }
      const list = sessions.list.getSnapshot()
      return {
        summaries: list.byId,
        // The conversation on screen is the one whose row shows as current.
        current: Object.values(list.byId)
          .find(session => (session.retainedBy.mainView ?? 0) > 0)?.id,
      }
    }

    const childrenFor = (facts: SessionFacts): ThreadChildren => {
      const children = new Map<string, readonly CatalogChild[]>()
      for (const record of threads.getSnapshot().records) {
        if (children.has(record.capabilityId)) continue
        children.set(record.capabilityId, threadRows(threads.of(record.capabilityId),
          facts.summaries, facts.current).map(row => ({
          id: row.sessionId,
          // A conversation nobody has named yet is named here, in the sidebar's
          // own words for exactly that: a new conversation.
          label: row.title === '' ? t('entry.thread.blank') : row.title,
          target: { kind: 'command' as const, run: () => { launcher.open(row.sessionId) } },
          running: row.running,
          active: row.active,
        })))
      }
      return children
    }

    /** Republish the groups. `centres` moves rarely, so it always republishes. */
    const publish = (centres: boolean): void => {
      const snapshot = centers.getSnapshot()
      const children = childrenFor(sessionFacts())
      const next = childrenSignature(children)
      if (!centres && next === signature) return
      signature = next
      for (const dispose of disposers) dispose()
      disposers = DIRECTORY_GROUPS.map(group =>
        ctx.sidebarCatalog.register(catalogGroup(group, snapshot, t, children,
          (entryId) => { openEntry(group.panelId, entryId) })))
    }

    publish(true)
    const stops: (() => void)[] = [
      centers.subscribe(() => { publish(true) }),
      threads.subscribe(() => { publish(false) }),
    ]
    if (sessions !== undefined) {
      stops.push(sessions.list.subscribe(() => {
        const list = sessions.list.getSnapshot()
        // Only once the Host has answered: an empty pending list would read as
        // "every conversation is gone" and drop every binding on startup.
        if (list.phase === 'ready') threads.keep(new Set(Object.keys(list.byId)))
        publish(false)
      }))
    }
    return () => {
      for (const stop of stops) stop()
      for (const dispose of disposers) dispose()
    }
  }, 'ui-brand-suixing: directory catalogue')
  return focus
}
