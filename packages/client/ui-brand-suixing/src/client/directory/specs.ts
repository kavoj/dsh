/**
 * Capability metadata for the SuiXing directory.
 *
 * The plan's §6.3 template decision — one configured page per capability kind
 * rather than one page per capability — lives in these descriptors: a group,
 * its menu copy, the main panel its directory opens, and the definition rows
 * every capability inside it renders. The sidebar shell owns none of it.
 */
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { SuiXingDirectoryKey } from './locales.ts'

/** One definition row of a capability: a shared term plus this capability's value. */
export interface CapabilityField {
  /** Shared field term (`field.*`). */
  readonly termKey: SuiXingDirectoryKey
  /** This capability's value for that term. */
  readonly valueKey: SuiXingDirectoryKey
}

/** One capability as the directory template renders it. */
export interface CapabilitySpec {
  /** Stable identity; the sidebar entry and its recency use it. */
  readonly id: string
  /** Capability name. */
  readonly labelKey: SuiXingDirectoryKey
  /** The prototype's lead line: the capability's one-sentence promise. */
  readonly hintKey: SuiXingDirectoryKey
  /** The definition rows the directory shows for this capability. */
  readonly fields: readonly CapabilityField[]
}

/** One collapsible business menu plus the panel its directory opens. */
export interface DirectoryGroupSpec {
  /** Stable group identity; the fold state is recorded against it. */
  readonly id: string
  /** Menu order; the plan puts AI参谋部 above 自动化工厂. */
  readonly order: number
  /** Menu title. */
  readonly titleKey: SuiXingDirectoryKey
  /** Menu secondary name (`辅助名称`). */
  readonly hintKey: SuiXingDirectoryKey
  /** Main panel this group's "view all" opens. */
  readonly panelId: MainPanelId
  /** Declared capabilities, in prototype order. */
  readonly entries: readonly CapabilitySpec[]
}

/** The nine AI参谋部 agents of the approved prototype. */
export type AgentId =
  | 'chief' | 'brand' | 'legal' | 'assistant' | 'copy'
  | 'people' | 'videoIp' | 'eastern' | 'sales'

/** The four 自动化工厂 scenarios of the approved prototype. */
export type WorkflowId = 'xhs' | 'campaign' | 'livestream' | 'report'

/**
 * The four 创作工具 of the approved prototype (Plan §2). They share the Agent
 * center with the nine agents but carry a creator-confirmation shape: a first
 * question and a list of confirmation items (用途/比例/数量/时长/人声 …) rather
 * than the agent's material-only follow-up.
 */
export type CreationId = 'ppt' | 'image' | 'video' | 'music'

/** Panel key of the AI参谋部 directory. */
export const AGENTS_PANEL = 'suixing-agents' as MainPanelId

/** Panel key of the 自动化工厂 directory. */
export const AUTOMATION_PANEL = 'suixing-automation' as MainPanelId

/** AI参谋部 agents, in prototype order. */
export const AGENT_IDS: readonly AgentId[] = [
  'chief', 'brand', 'legal', 'assistant', 'copy', 'people', 'videoIp', 'eastern', 'sales',
]

/** AI参谋部 creation tools, in prototype order. */
export const CREATION_IDS: readonly CreationId[] = ['ppt', 'image', 'video', 'music']

/** 自动化工厂 scenarios, in prototype order. */
export const WORKFLOW_IDS: readonly WorkflowId[] = ['xhs', 'campaign', 'livestream', 'report']

/**
 * Build one AI参谋部 agent from its identity.
 * The template keys are computed from `id`, so a missing dictionary key is a
 * compile error rather than a blank row at runtime.
 * @param id - prototype agent id.
 * @returns the capability descriptor.
 */
function agent(id: AgentId): CapabilitySpec {
  return {
    id,
    labelKey: `entry.${id}`,
    hintKey: `entry.${id}.hint`,
    fields: [
      { termKey: 'field.purpose', valueKey: `entry.${id}.purpose` },
      { termKey: 'field.tasks', valueKey: `entry.${id}.tasks` },
      { termKey: 'field.material', valueKey: `entry.${id}.material` },
    ],
  }
}

/**
 * Build one 创作工具 from its identity.
 * The creator-confirmation shape reuses `purpose`/`tasks`/`material` and adds
 * `firstQuestion` (the prototype's 第一轮追问) and `confirmItems` (初步确认项).
 * @param id - prototype creation-tool id.
 * @returns the capability descriptor.
 */
function creation(id: CreationId): CapabilitySpec {
  return {
    id,
    labelKey: `entry.${id}`,
    hintKey: `entry.${id}.hint`,
    fields: [
      { termKey: 'field.purpose', valueKey: `entry.${id}.purpose` },
      { termKey: 'field.tasks', valueKey: `entry.${id}.tasks` },
      { termKey: 'field.firstQuestion', valueKey: `entry.${id}.firstQuestion` },
      { termKey: 'field.confirmItems', valueKey: `entry.${id}.confirmItems` },
      { termKey: 'field.material', valueKey: `entry.${id}.material` },
    ],
  }
}

/**
 * Build one 自动化工厂 scenario from its identity.
 * @param id - prototype scenario id.
 * @returns the capability descriptor.
 */
function workflow(id: WorkflowId): CapabilitySpec {
  return {
    id,
    labelKey: `entry.${id}`,
    hintKey: `entry.${id}.hint`,
    fields: [
      { termKey: 'field.prepare', valueKey: `entry.${id}.prepare` },
      { termKey: 'field.confirm', valueKey: `entry.${id}.confirm` },
      { termKey: 'field.result', valueKey: `entry.${id}.result` },
      { termKey: 'field.steps', valueKey: `entry.${id}.steps` },
      { termKey: 'field.note', valueKey: `entry.${id}.note` },
    ],
  }
}

/** The two business menus this distribution publishes, in menu order. */
export const DIRECTORY_GROUPS: readonly DirectoryGroupSpec[] = [
  {
    id: 'suixing.ai-staff',
    order: 10,
    titleKey: 'group.agents',
    hintKey: 'group.agents.hint',
    panelId: AGENTS_PANEL,
    // Plan §2: the Agent center hosts the nine agents and the four creation
    // tools. They share one ordered list so the menu stays a single surface.
    entries: [...AGENT_IDS.map(agent), ...CREATION_IDS.map(creation)],
  },
  {
    id: 'suixing.automation',
    order: 20,
    titleKey: 'group.automation',
    hintKey: 'group.automation.hint',
    panelId: AUTOMATION_PANEL,
    entries: WORKFLOW_IDS.map(workflow),
  },
]

/**
 * Find one group by its stable id.
 * @param id - group id to look up.
 * @returns the group, or undefined when the id is not published.
 */
export function directoryGroup(id: string): DirectoryGroupSpec | undefined {
  return DIRECTORY_GROUPS.find(group => group.id === id)
}
