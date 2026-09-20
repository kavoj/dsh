/**
 * SuiXing occupants for the generic browser-brand slots, sidebar catalogue,
 * and the business-centre settings page.
 *
 * Additive by construction. Everything here is a *contribution* to a seat the
 * base client already owns and declares: the brand mark and name inside the
 * existing sidebar header, catalogue groups the shell renders generically, and
 * one more page in the existing settings panel. Nothing replaces a base
 * occupant — the New Session control, the settings host, the workspace browser,
 * and the panel rows all keep running exactly as they did without this
 * package, which is also why unloading the distribution restores that sidebar
 * byte for byte.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { SuiXingBrandMark, SuiXingBrandName } from './Brand.tsx'
import { CentersSection, type CentersSectionInjected } from './centers/CentersSection.tsx'
import { CENTERS_NS, en as centersEn, zh as centersZh, type SuiXingCentersKey } from './centers/locales.ts'
import { createCentersService } from './centers/store.ts'
import { registerSuiXingDirectory } from './directory/index.ts'
import type { SuiXingDirectoryKey } from './directory/locales.ts'
import { en, NS, zh, type SuiXingBrandKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The SuiXing distribution's own product name. */
    'suixing-brand': SuiXingBrandKey
    /** Copy of the SuiXing capability directory: its menus and their pages. */
    'suixing-directory': SuiXingDirectoryKey
    /** Copy of the business-centre settings page. */
    'suixing-centers': SuiXingCentersKey
  }
}

export type { SuiXingBrandNameProps } from './Brand.tsx'
export type { CentersSectionInjected, CentersSectionProps } from './centers/CentersSection.tsx'
export type { CenterSource, CentersService, CentersSnapshot, CentersState } from './centers/store.ts'
export {
  draftAgentSpec, draftWorkflowSpec, clarifyQuestions, outputLabel, OUTPUT_KINDS,
  type AgentDraft, type AgentSpec, type ClarifyAnswers, type ClarifySlot,
  type OutputKind, type WorkflowDraft, type WorkflowSpec,
} from './centers/spec.ts'

/** Required services: the UI slot registry, the locale registry, and the sidebar's catalogue. */
export const inject = ['locale', 'slots', 'sidebarCatalog']

/** Nav order of the business-centre page: after every base settings section. */
const CENTERS_SECTION_ORDER = 30

/**
 * Fill the sidebar brand slots, publish the capability directory, and add the
 * business-centre page to Settings, only for the isolated SuiXing build
 * profile.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  if (process.env.DSH_CLIENT_BUILD_PROFILE !== 'suixing') return
  // One service behind both surfaces: the page writes it, the directory reads
  // it, so "build an agent here" and "see it in the menu" are one fact.
  const centers = createCentersService()
  registerSuiXingDirectory(ctx, centers)
  ctx.effect(
    () => ctx.locale.register(CENTERS_NS, { zh: centersZh, en: centersEn }),
    'ui-brand-suixing: centres dictionaries',
  )
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-brand-suixing: dictionaries')
  // The settings shell declares `settings.section`; this registration follows
  // it, the same way every feature-owned settings page does.
  const injected = (): CentersSectionInjected => ({
    hooks: { centers },
    setSource: (source) => { centers.setSource(source) },
    setRemoteBaseUrl: (url) => { centers.setRemoteBaseUrl(url) },
    addAgent: (draft) => { centers.addAgent(draft) },
    removeAgent: (id) => { centers.removeAgent(id) },
    addWorkflow: (draft) => { centers.addWorkflow(draft) },
    removeWorkflow: (id) => { centers.removeWorkflow(id) },
  })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'suixing-centers',
    order: CENTERS_SECTION_ORDER,
    label: () => ctx.locale.bind(CENTERS_NS)('section.title'),
    locale: CENTERS_NS,
    inject: injected,
  }, CentersSection))
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, SuiXingBrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name', locale: NS }, SuiXingBrandName)
    }))
}
