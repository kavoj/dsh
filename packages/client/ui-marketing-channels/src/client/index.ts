/**
 * Marketing channel catalog, browser half: the **Channels** entry of the
 * sidebar and the catalog page it opens. The page classifies promotion
 * platforms by authorization availability — the fact that decides whether a
 * self-built marketing system can reach a platform through an official write
 * API, a CPS union, an enterprise-only platform, an app-review gate, or only
 * through browser automation. The catalog itself is static data owned by this
 * package; the page reads no Remote.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { ChannelsPanelIcon } from './ChannelsPanelIcon.tsx'
import { ChannelsPage } from './ChannelsPage.tsx'

/** The id shared by the sidebar entry and the main panel it opens. */
export const PANEL_ID = 'marketing-channels' as MainPanelId

/** Services required by the sidebar and main registrations. */
export const inject = ['slots']

/**
 * Contribute the Channels entry to the sidebar with the catalog page it opens.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  // The page is a global panel: it belongs to the installation, not to a
  // Session, and the sidebar's entry selects it.
  ctx.slots.inject('main', function* () {
    yield ctx.slots.register({ name: 'main', key: PANEL_ID }, ChannelsPage)
  })
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    // Above the Plugins entry, which registers order 0.
    order: -10,
    label: () => '渠道',
  }, ChannelsPanelIcon))
}
