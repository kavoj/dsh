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
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { CatalogGroup } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { CentersService, CentersSnapshot } from '../centers/store.ts'
import { DirectoryPage } from './DirectoryPage.tsx'
import { DIRECTORY_NS, directoryEn, directoryZh, type SuiXingDirectoryKey } from './locales.ts'
import { AGENTS_PANEL, AUTOMATION_PANEL, DIRECTORY_GROUPS, type DirectoryGroupSpec } from './specs.ts'

export { DirectoryPage, type DirectoryPageProps } from './DirectoryPage.tsx'
export { DIRECTORY_NS, directoryEn, directoryZh, type SuiXingDirectoryKey } from './locales.ts'
export {
  AGENTS_PANEL, AUTOMATION_PANEL, PROJECTS_PANEL, AGENT_IDS, CREATION_IDS, WORKFLOW_IDS,
  PROJECT_IDS, DIRECTORY_GROUPS, directoryGroup,
  type AgentId, type CreationId, type ProjectId, type WorkflowId,
  type CapabilityField, type CapabilitySpec, type DirectoryGroupSpec,
} from './specs.ts'

/** One capability the user built locally, as an entry and as a page row. */
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
 * the platform's, not the local architect's).
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
 * @returns the group as the sidebar takes it.
 */
function catalogGroup(
  group: DirectoryGroupSpec, snapshot: CentersSnapshot, t: Translate<SuiXingDirectoryKey>,
): CatalogGroup {
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
      ...group.entries.map(capability => ({
        id: capability.id,
        label: t(capability.labelKey),
        hint: t(capability.hintKey),
        // Until a capability's working page lands, both the menu row and
        // "view all" open the directory that carries its definition.
        target: { kind: 'panel' as const, panelId: group.panelId },
      })),
      ...localCapabilities(group, snapshot).map(local => ({
        id: local.id,
        label: local.name,
        hint: local.hint,
        target: { kind: 'panel' as const, panelId: group.panelId },
      })),
    ],
  }
}

/**
 * Register the directory's dictionaries, groups, and panels.
 * @param ctx - Client root context carrying the catalog, slot, and locale services.
 * @param centers - the business-centre configuration the local entries come from.
 */
export function registerSuiXingDirectory(ctx: ClientContext, centers: CentersService): void {
  ctx.effect(
    () => ctx.locale.register(DIRECTORY_NS, { zh: directoryZh, en: directoryEn }),
    'ui-brand-suixing: directory dictionaries',
  )
  const t = ctx.locale.bind(DIRECTORY_NS)
  // The panels are keyed slots registered once: their content follows the
  // store through a bound hook instead, so a new agent shows up in "view all"
  // without re-registering a component.
  for (const group of DIRECTORY_GROUPS) {
    ctx.slots.inject('main', () => ctx.slots.register({
      name: 'main',
      key: group.panelId,
      locale: DIRECTORY_NS,
      inject: () => ({ group, hooks: { centers } }),
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
        ctx.sidebarCatalog.register(catalogGroup(group, snapshot, t)))
    }
    publish()
    const stop = centers.subscribe(publish)
    return () => {
      stop()
      for (const dispose of disposers) dispose()
    }
  }, 'ui-brand-suixing: directory catalogue')
}
