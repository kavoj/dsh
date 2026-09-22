/**
 * SuiXing occupants for the generic browser-brand slots, sidebar catalogue,
 * the business-centre settings page, and the capability-connection page.
 *
 * Additive by construction. Everything here is a *contribution* to a seat the
 * base client already owns and declares: the brand mark and name inside the
 * existing sidebar header, catalogue groups the shell renders generically, and
 * two more pages in the existing settings panel. Nothing replaces a base
 * occupant — the New Session control, the settings host, the workspace browser,
 * and the panel rows all keep running exactly as they did without this
 * package, which is also why unloading the distribution restores that sidebar
 * byte for byte.
 *
 * The two things it does create are both the base client's own entities: a
 * conversation started from a capability is an ordinary Session (see
 * `threads/`), and a capability named in a chat is an ordinary `@` reference
 * (see `references/`).
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { BridgesSection, type BridgesSectionInjected } from './bridges/BridgesSection.tsx'
import { BRIDGES_NS, en as bridgesEn, zh as bridgesZh, type SuiXingBridgesKey } from './bridges/locales.ts'
import { createBridgesService } from './bridges/store.ts'
import { SuiXingBrandMark, SuiXingBrandName } from './Brand.tsx'
import { CentersSection, type CentersSectionInjected } from './centers/CentersSection.tsx'
import { CENTERS_NS, en as centersEn, zh as centersZh, type SuiXingCentersKey } from './centers/locales.ts'
import { createCentersService } from './centers/store.ts'
import { registerSuiXingDirectory } from './directory/index.ts'
import type { SuiXingDirectoryKey } from './directory/locales.ts'
import { en, NS, zh, type SuiXingBrandKey } from './locales.ts'
import { createThreadsService, type ThreadsService } from './threads/store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The SuiXing distribution's own product name. */
    'suixing-brand': SuiXingBrandKey
    /** Copy of the SuiXing capability directory: its menus and their pages. */
    'suixing-directory': SuiXingDirectoryKey
    /** Copy of the business-centre settings page. */
    'suixing-centers': SuiXingCentersKey
    /** Copy of the capability-connection settings page. */
    'suixing-bridges': SuiXingBridgesKey
  }
}

export type { SuiXingBrandNameProps } from './Brand.tsx'
export type { BridgesSectionInjected, BridgesSectionProps } from './bridges/BridgesSection.tsx'
export type { BridgeCentre, BridgeMode, BridgeSpec, BridgeStatus } from './bridges/spec.ts'
export type { BridgesService, BridgesSnapshot } from './bridges/store.ts'
export type { CentersSectionInjected, CentersSectionProps } from './centers/CentersSection.tsx'
export type { CenterSource, CentersService, CentersSnapshot, CentersState } from './centers/store.ts'
export type { CapabilityRow, LocalCapability } from './directory/capabilities.ts'
export type { ThreadLauncher } from './threads/launcher.ts'
export type { ThreadRecord, ThreadRow, ThreadSummary } from './threads/spec.ts'
export type { ThreadsService, ThreadsSnapshot } from './threads/store.ts'
export {
  BRIDGES, DEFAULT_PLATFORM_BASE, bridge, bridgeStatus, bridgeUrl, platformCount,
  EMPTY_BRIDGE_CONFIG, type BridgeConfig,
} from './bridges/spec.ts'
export {
  draftAgentSpec, draftWorkflowSpec, clarifyQuestions, outputLabel, OUTPUT_KINDS,
  type AgentDraft, type AgentSpec, type ClarifyAnswers, type ClarifySlot,
  type OutputKind, type WorkflowDraft, type WorkflowSpec,
} from './centers/spec.ts'
export { capabilityRows, localCapabilities } from './directory/capabilities.ts'
export { CAPABILITY_PRESETS, presetFor } from './presets/spec.ts'
export { THREAD_VISIBLE_LIMIT, liveThreads, threadRows } from './threads/spec.ts'
export { THREADS_PERSIST_NAME, createThreadsService } from './threads/store.ts'
export type { RolePresets } from './presets/index.ts'
export {
  REFERENCE_LIMIT, REF_PREFIX, clipboardTextOf, matchReferences, parseReference, referenceOf,
  serializeReference, serializeUnresolved, toReference,
  type CapabilityReference,
} from './references/spec.ts'

/** Required services: the UI slot registry, the locale registry, the sidebar's
 * catalogue, and the panel selector an activated entry navigates with. */
export const inject = ['locale', 'slots', 'sidebarCatalog', 'layout']

/** Nav order of the business-centre page: after every base settings section. */
const CENTERS_SECTION_ORDER = 30

/** Nav order of the capability-connection page: right after the centres. */
const BRIDGES_SECTION_ORDER = 31

/**
 * Fill the sidebar brand slots, publish the capability directory, and add the
 * business-centre and capability-connection pages to Settings, only for the
 * isolated SuiXing build profile.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  if (process.env.DSH_CLIENT_BUILD_PROFILE !== 'suixing') return
  // Three services behind the three surfaces: the centres answer "which
  // capabilities exist", the connections answer "who runs this capability", and
  // the threads answer "which conversations did it start". All three are read
  // by the directory, so a change in Settings or a started conversation is a
  // change in the menu without a second step.
  const centers = createCentersService()
  const bridges = createBridgesService()
  const threads: ThreadsService = createThreadsService()
  // The workspace tree drops every bound conversation: a capability's chat
  // lives in its capability's own menu, not doubled into the workspace list.
  // Optional service — absent without this distribution, the tree renders
  // everything it did before.
  ctx.provide('sessionTreeExclusion', {
    hiddenSessionIds: () => new Set(threads.getSnapshot().records.map(record => record.sessionId)),
  })
  registerSuiXingDirectory(ctx, centers, bridges, threads)
  ctx.effect(
    () => ctx.locale.register(CENTERS_NS, { zh: centersZh, en: centersEn }),
    'ui-brand-suixing: centres dictionaries',
  )
  ctx.effect(
    () => ctx.locale.register(BRIDGES_NS, { zh: bridgesZh, en: bridgesEn }),
    'ui-brand-suixing: bridges dictionaries',
  )
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-brand-suixing: dictionaries')
  // The settings shell declares `settings.section`; these registrations follow
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
  const injectedBridges = (): BridgesSectionInjected => ({
    hooks: { bridges },
    setBaseUrl: (url) => { bridges.setBaseUrl(url) },
    setApiKey: (key) => { bridges.setApiKey(key) },
    setMode: (id, mode) => { bridges.setMode(id, mode) },
    setEndpoint: (id, endpoint) => { bridges.setEndpoint(id, endpoint) },
    setAllModes: (mode) => { bridges.setAllModes(mode) },
  })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'suixing-bridges',
    order: BRIDGES_SECTION_ORDER,
    label: () => ctx.locale.bind(BRIDGES_NS)('section.title'),
    locale: BRIDGES_NS,
    inject: injectedBridges,
  }, BridgesSection))
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, SuiXingBrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name', locale: NS }, SuiXingBrandName)
    }))
}
