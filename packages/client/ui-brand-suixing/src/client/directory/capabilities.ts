/**
 * The capability list, flattened.
 *
 * Two sources feed every menu: the spec this distribution ships, and the
 * capabilities the user built from a sentence in Settings. The sidebar reads
 * them as entries and the `@` menu reads them as references, so the projection
 * lives once, here, rather than being walked twice with two chances to drift.
 */
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { CentersSnapshot } from '../centers/store.ts'
import type { SuiXingDirectoryKey } from './locales.ts'
import { AGENTS_PANEL, AUTOMATION_PANEL, type DirectoryGroupSpec } from './specs.ts'

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

/** One capability with the menu it belongs to, ready to render or to reference. */
export interface CapabilityRow {
  /** Owning group's stable id. */
  readonly groupId: string
  /** Owning group's descriptor; its panel is where the capability is shown. */
  readonly group: DirectoryGroupSpec
  /** Menu title, already localized. */
  readonly groupTitle: string
  /** The capability's id, shipped or locally built. */
  readonly id: string
  /** Display name, already localized. */
  readonly label: string
  /** One-line promise, already localized. */
  readonly hint: string
  /** True when this machine built it from a sentence. */
  readonly local: boolean
}

/**
 * Flatten every menu into one ordered list of capabilities.
 * @param groups - the published menus, in menu order.
 * @param snapshot - the current business-centre configuration.
 * @param t - directory translate seat.
 * @returns shipped and locally built capabilities, shipped first per menu.
 */
export function capabilityRows(
  groups: readonly DirectoryGroupSpec[],
  snapshot: CentersSnapshot,
  t: Translate<SuiXingDirectoryKey>,
): readonly CapabilityRow[] {
  return groups.flatMap((group) => {
    const groupTitle = t(group.titleKey)
    return [
      ...group.entries.map(capability => ({
        groupId: group.id,
        group,
        groupTitle,
        id: capability.id,
        label: t(capability.labelKey),
        hint: t(capability.hintKey),
        local: false,
      })),
      ...localCapabilities(group, snapshot).map(local => ({
        groupId: group.id,
        group,
        groupTitle,
        id: local.id,
        label: local.name,
        hint: local.hint,
        local: true,
      })),
    ]
  })
}
