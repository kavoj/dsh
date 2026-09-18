/** SuiXing occupants for the generic browser-brand slots and sidebar catalogue. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { SuiXingBrandMark, SuiXingBrandName } from './Brand.tsx'
import { registerSuiXingDirectory } from './directory/index.ts'
import type { SuiXingDirectoryKey } from './directory/locales.ts'
import { en, NS, zh, type SuiXingBrandKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The SuiXing distribution's own product name. */
    'suixing-brand': SuiXingBrandKey
    /** Copy of the SuiXing capability directory: its two menus and their pages. */
    'suixing-directory': SuiXingDirectoryKey
  }
}

export type { SuiXingBrandNameProps } from './Brand.tsx'

/** Required services: the UI slot registry, the locale registry, and the sidebar's catalogue. */
export const inject = ['locale', 'slots', 'sidebarCatalog']

/**
 * Fill the sidebar brand slots and publish the capability directory, only for
 * the isolated SuiXing build profile.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  if (process.env.DSH_CLIENT_BUILD_PROFILE !== 'suixing') return
  registerSuiXingDirectory(ctx)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-brand-suixing: dictionaries')
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, SuiXingBrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name', locale: NS }, SuiXingBrandName)
    }))
}
