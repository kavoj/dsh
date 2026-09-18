/**
 * Publish the SuiXing capability directory.
 *
 * The two business menus of the plan's §2.1 decision arrive here as data: a
 * catalog group the sidebar shell renders generically, a main panel its
 * "view all" opens, and the page definitions those panels show. Nothing about
 * the menus reaches the base layout, so a build that never calls this adds no
 * sidebar DOM at all.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { DirectoryPage } from './DirectoryPage.tsx'
import { DIRECTORY_NS, directoryEn, directoryZh } from './locales.ts'
import { DIRECTORY_GROUPS } from './specs.ts'

export { DirectoryPage, type DirectoryPageProps } from './DirectoryPage.tsx'
export { DIRECTORY_NS, directoryEn, directoryZh, type SuiXingDirectoryKey } from './locales.ts'
export {
  AGENTS_PANEL, AUTOMATION_PANEL, AGENT_IDS, WORKFLOW_IDS, DIRECTORY_GROUPS, directoryGroup,
  type AgentId, type WorkflowId, type CapabilityField, type CapabilitySpec, type DirectoryGroupSpec,
} from './specs.ts'

/**
 * Register the directory's dictionaries, groups, and panels.
 * @param ctx - Client root context carrying the catalog, slot, and locale services.
 */
export function registerSuiXingDirectory(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.register(DIRECTORY_NS, { zh: directoryZh, en: directoryEn }),
    'ui-brand-suixing: directory dictionaries',
  )
  const t = ctx.locale.bind(DIRECTORY_NS)
  // The catalog is the shell's; this module only publishes into it. The slot
  // injections follow their own parent entry, so only the catalog
  // registrations need the effect's disposer.
  ctx.effect(() => {
    const disposers = DIRECTORY_GROUPS.map((group) => {
      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: group.panelId,
        locale: DIRECTORY_NS,
        inject: () => ({ group }),
      }, DirectoryPage))
      return ctx.sidebarCatalog.register({
        id: group.id,
        order: group.order,
        title: t(group.titleKey),
        hint: t(group.hintKey),
        allPanel: group.panelId,
        entries: group.entries.map(capability => ({
          id: capability.id,
          label: t(capability.labelKey),
          hint: t(capability.hintKey),
          // Until a capability's working page lands, both the menu row and
          // "view all" open the directory that carries its definition.
          target: { kind: 'panel' as const, panelId: group.panelId },
        })),
      })
    })
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-brand-suixing: directory catalogue')
}
