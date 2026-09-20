/**
 * Publish the SuiXing capability directory.
 *
 * The business menus of the plan's §2.1 decision arrive here as data: a catalog
 * group the sidebar shell renders generically, a main panel its "view all"
 * opens, and the page definitions those panels show. Nothing about the menus
 * reaches the base layout, so a build that never calls this adds no sidebar DOM
 * at all.
 *
 * The group data is a *projection of two sources*: the shipped spec plus the
 * capabilities the user built from a sentence in Settings. The catalogue is
 * rebuilt whenever either moves, which is what makes "draft an agent" and "see
 * it in the menu" one step for the user rather than a sync problem. A shipped
 * group keeps its entries; the local ones append after them.
 *
 * Activating an entry is the same navigation as opening a card: it writes the
 * focused capability and selects the menu's panel. The sidebar therefore lands
 * on the capability itself, and the panel's list is one step back — the
 * prototype's behaviour, expressed as data the shell already knows how to run.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { CatalogGroup } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { BridgesService } from '../bridges/store.ts'
import type { CentersService, CentersSnapshot } from '../centers/store.ts'
import { DirectoryPage } from './DirectoryPage.tsx'
import { createDirectoryFocus, type DirectoryFocus } from './focus.ts'
import { DIRECTORY_NS, directoryEn, directoryZh, type SuiXingDirectoryKey } from './locales.ts'
import {
  AGENTS_PANEL, AUTOMATION_PANEL, CREATION_PANEL, DIRECTORY_GROUPS, type DirectoryGroupSpec,
} from './specs.ts'

export { CapabilityDetail, type CapabilityDetailProps, type DetailConnection, type DetailTarget } from './CapabilityDetail.tsx'
export { DirectoryPage, type DirectoryPageProps } from './DirectoryPage.tsx'
export { createDirectoryFocus, type DirectoryFocus } from './focus.ts'
export { DIRECTORY_NS, directoryEn, directoryZh, type SuiXingDirectoryKey } from './locales.ts'
export {
  AGENTS_PANEL, AUTOMATION_PANEL, PROJECTS_PANEL, CREATION_PANEL,
  AGENT_IDS, CREATION_IDS, WORKFLOW_IDS, PROJECT_IDS, DIRECTORY_GROUPS, directoryGroup,
  type AgentId, type CreationId, type ProjectId, type WorkflowId,
  type CapabilityField, type CapabilitySpec, type DirectoryGroupSpec,
} from './specs.ts'

/** One capability the user built locally, as an entry and as a list row. */
export interface LocalCapability {
  /** Local store id, distinct from every shipped entry id. */
  readonly id: string
  /** The name the user kept. */
  readonly name: string
  /** Its one-line promise, or the step names of a workflow. */
  readonly hint: string
}

/**
 * The local capabilities that belong in one group: agents in the AI staff
 * centre, workflows in the automation centre, none in 项目管理 (its model is
 * the platform's, not the local architect's) nor in 创作中心 (its four
 * capabilities ship with the product and carry platform sockets instead).
 * @param group - the group being published.
 * @param snapshot - the current business-centre configuration.
 * @returns the local capabilities, in creation order.
 */
export function localCapabilities(
  group: DirectoryGroupSpec, snapshot: CentersSnapshot,
): readonly LocalCapability[] {
  if (group.panelId === AGENTS_PANEL) {
    return snapshot.agents.map(agent => ({ id: agent.id, name: agent.name, hint: agent.oneLiner }))
  }
  if (group.panelId === AUTOMATION_PANEL) {
    return snapshot.workflows.map(flow => ({
      id: flow.id,
      name: flow.name,
      hint: flow.steps.map(step => step.name).join(' → '),
    }))
  }
  return []
}

/**
 * Project one group descriptor plus the local capabilities onto the catalog
 * shape the sidebar renders.
 * @param group - the shipped group descriptor.
 * @param snapshot - the current business-centre configuration.
 * @param t - directory translate seat.
 * @param openEntry - performs the navigation an activated entry asks for.
 * @returns the group as the sidebar takes it.
 */
function catalogGroup(
  group: DirectoryGroupSpec, snapshot: CentersSnapshot, t: Translate<SuiXingDirectoryKey>,
  openEntry: (entryId: string) => void,
): CatalogGroup {
  const entry = (id: string, label: string, hint: string) => ({
    id,
    label,
    hint,
    // Opening an entry lands on the capability itself: the focused id is what
    // the menu's panel reads, so one navigation serves the entry and the card.
    target: { kind: 'command' as const, run: () => { openEntry(id) } },
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

/** Panel keys the connection badge is meaningful on. */
const BRIDGED_PANELS = new Set<string>([CREATION_PANEL])

/**
 * Register the directory's dictionaries, groups, and panels.
 * @param ctx - Client root context carrying the catalog, slot, locale, and layout services.
 * @param centers - the business-centre configuration the local entries come from.
 * @param bridges - the capability-connection configuration the pages read.
 * @returns the focus service, so a caller that already shows a capability can drive it.
 */
export function registerSuiXingDirectory(
  ctx: ClientContext, centers: CentersService, bridges: BridgesService,
): DirectoryFocus {
  ctx.effect(
    () => ctx.locale.register(DIRECTORY_NS, { zh: directoryZh, en: directoryEn }),
    'ui-brand-suixing: directory dictionaries',
  )
  const t = ctx.locale.bind(DIRECTORY_NS)
  const focus = createDirectoryFocus()
  // One navigation, two writers: the sidebar entry and the card both say "show
  // this capability", and the panel that renders it is the menu's own.
  const openEntry = (panelId: MainPanelId, entryId: string): void => {
    focus.focus(entryId)
    ctx.layout.selectPanel(panelId)
  }
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
        openConversation: () => { ctx.layout.selectPanel(null) },
      }),
    }, DirectoryPage))
  }
  // The sidebar takes plain data, so the catalogue is re-published whenever the
  // centres move. Each registration replaces its predecessor by id, and the
  // effect's disposer releases the last set.
  ctx.effect(() => {
    let disposers: readonly (() => void)[] = []
    const publish = (): void => {
      for (const dispose of disposers) dispose()
      const snapshot = centers.getSnapshot()
      disposers = DIRECTORY_GROUPS.map(group =>
        ctx.sidebarCatalog.register(catalogGroup(group, snapshot, t,
          (entryId) => { openEntry(group.panelId, entryId) })))
    }
    publish()
    const stop = centers.subscribe(publish)
    return () => {
      stop()
      for (const dispose of disposers) dispose()
    }
  }, 'ui-brand-suixing: directory catalogue')
  return focus
}
