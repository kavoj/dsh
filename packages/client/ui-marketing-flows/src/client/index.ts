/**
 * Saved content pipelines, browser half: the sidebar's Flows region and the
 * workspace panel it opens. The region sits at the same level as the workspace
 * browser (`sidebar.flows`, declared by ui-sidebar), so a saved pipeline is as
 * reachable as a workspace.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { bindPanelOpener } from './flows-api.ts'
import { FlowsPage } from './FlowsPage.tsx'
import { FlowsSection } from './FlowsSection.tsx'

/** The id shared by the sidebar region and the main panel it opens. */
export const PANEL_ID = 'marketing-flows' as MainPanelId

/** Services required by the region and panel registrations. */
export const inject = ['slots', 'layout']

/**
 * Contribute the Flows region to the sidebar with the workspace panel it opens.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  // The rows and the panel share one selection, so a sidebar click moves both.
  bindPanelOpener(() => ctx.layout.selectPanel(PANEL_ID))
  ctx.slots.inject('main', function* () {
    yield ctx.slots.register({ name: 'main', key: PANEL_ID }, FlowsPage)
  })
  ctx.slots.inject('sidebar.flows', () => ctx.slots.register({ name: 'sidebar.flows' }, FlowsSection))
}
