/**
 * Capability metadata for the SuiXing directory.
 *
 * The plan's §6.3 template decision — one configured page per capability kind
 * rather than one page per capability — lives in these descriptors: a group,
 * its menu copy, the main panel its directory opens, and the definition rows
 * every capability inside it renders. The sidebar shell owns none of it.
 *
 * 老谢 2026-09-20: 创作中心 is the fourth business menu, seated below
 * 项目管理. The four creation tools moved out of AI参谋部 into it, so each
 * menu now names one kind of work: agents, workflow scenarios, projects, and
 * creations.
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
  /**
   * The rows the menu's list card shows, when the full definition is too much
   * for a card. Absent means the card shows every field.
   */
  readonly card?: readonly CapabilityField[]
  /**
   * Opening questions the conversation's hero shows as one-tap starters.
   * Absent means the hero carries the name, the promise, and the how-to only.
   */
  readonly starters?: readonly SuiXingDirectoryKey[]
  /**
   * The composer's opening example on the conversation hero. Absent falls
   * back to the first starter, then the base hero placeholder.
   */
  readonly exampleKey?: SuiXingDirectoryKey
}

/** One collapsible business menu plus the panel its directory opens. */
export interface DirectoryGroupSpec {
  /** Stable group identity; the fold state is recorded against it. */
  readonly id: string
  /** Menu order; the plan puts AI参谋部 above 自动化工厂, 项目管理 below both. */
  readonly order: number
  /** Menu title. */
  readonly titleKey: SuiXingDirectoryKey
  /** Menu secondary name (`辅助名称`). */
  readonly hintKey: SuiXingDirectoryKey
  /** Main panel this group's "view all" opens. */
  readonly panelId: MainPanelId
  /**
   * Whether the sidebar may rename, remove, and add around this group. All
   * four SuiXing centres are manageable: the plan treats them as the user's
   * own business areas, and the sidebar's manage surface keeps those choices
   * browser-local, so nothing here is ever edited from the client. Required
   * rather than optional, so a centre added later states the decision instead
   * of inheriting one.
   */
  readonly manageable: boolean
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
 * The four 创作中心 capabilities of the approved prototype (Plan §2). They
 * carry a creator-confirmation shape: a first question and a list of
 * confirmation items (用途/比例/数量/时长/人声 …) rather than the agent's
 * material-only follow-up, and each one names a platform call it can be
 * pointed at (see `bridges/spec.ts`).
 */
export type CreationId = 'ppt' | 'image' | 'video' | 'music'

/**
 * The 项目管理 group of the approved prototype (页面引导与交互说明 §1/§5).
 * It sits *parallel* to the two business centers and groups conversations,
 * files, works, and workflow results per project. The concrete project model
 * arrives with the platform's project/workspace API, so this distribution
 * publishes one planning entry until that lands (DEC-03 fallback).
 */
export type ProjectId = 'home'

/** Panel key of the AI参谋部 directory. */
export const AGENTS_PANEL = 'suixing-agents' as MainPanelId

/** Panel key of the 自动化工厂 directory. */
export const AUTOMATION_PANEL = 'suixing-automation' as MainPanelId

/** Panel key of the 项目管理 directory. */
export const PROJECTS_PANEL = 'suixing-projects' as MainPanelId

/** Panel key of the 创作中心 directory. */
export const CREATION_PANEL = 'suixing-creation' as MainPanelId

/** AI参谋部 agents, in prototype order. */
export const AGENT_IDS: readonly AgentId[] = [
  'chief', 'brand', 'legal', 'assistant', 'copy', 'people', 'videoIp', 'eastern', 'sales',
]

/** 创作中心 capabilities, in prototype order. */
export const CREATION_IDS: readonly CreationId[] = ['ppt', 'image', 'video', 'music']

/** 自动化工厂 scenarios, in prototype order. */
export const WORKFLOW_IDS: readonly WorkflowId[] = ['xhs', 'campaign', 'livestream', 'report']

/** 项目管理 entries (placeholder until the platform project API lands). */
export const PROJECT_IDS: readonly ProjectId[] = ['home']

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
 * 总裁决策官 renders the approved self-introduction instead of the agent
 * template: the lead role speaks for itself on its page — who it is, which
 * problems it takes, how to hand one over, what it does and refuses to do,
 * and the decision thinking it teaches as it goes (老谢 2026-09-21).
 */
const CHIEF: CapabilitySpec = {
  id: 'chief',
  labelKey: 'entry.chief',
  hintKey: 'entry.chief.hint',
  fields: [
    { termKey: 'field.intro', valueKey: 'entry.chief.intro' },
    { termKey: 'field.problems', valueKey: 'entry.chief.problems' },
    { termKey: 'field.howto', valueKey: 'entry.chief.howto' },
    { termKey: 'field.cando', valueKey: 'entry.chief.cando' },
    { termKey: 'field.boundary', valueKey: 'entry.chief.boundary' },
    { termKey: 'field.mindset', valueKey: 'entry.chief.mindset' },
  ],
  // The conversation hero's one-tap starters (页面原型 01_总裁决策官_进入页).
  starters: ['starter.chief.1', 'starter.chief.2', 'starter.chief.3'],
  // The composer's opening example (same prototype's input placeholder).
  exampleKey: 'hero.example.chief',
  // The menu card keeps one row: the self-introduction carries the pitch.
  card: [
    { termKey: 'field.intro', valueKey: 'entry.chief.intro' },
  ],
}

/**
 * Build one 创作中心 capability from its identity.
 * The creator-confirmation shape reuses `purpose`/`tasks`/`material` and adds
 * `firstQuestion` (the prototype's 第一轮追问) and `confirmItems` (初步确认项).
 * @param id - prototype creation id.
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

/**
 * Build one 项目管理 entry from its identity.
 * The planning entry mirrors the agent shape so the directory renders it
 * without a bespoke page; its copy marks it pending the platform project API.
 * @param id - project entry id.
 * @returns the capability descriptor.
 */
function project(id: ProjectId): CapabilitySpec {
  return {
    id,
    labelKey: `entry.projects.${id}`,
    hintKey: `entry.projects.${id}.hint`,
    fields: [
      { termKey: 'field.purpose', valueKey: `entry.projects.${id}.purpose` },
      { termKey: 'field.tasks', valueKey: `entry.projects.${id}.tasks` },
      { termKey: 'field.material', valueKey: `entry.projects.${id}.material` },
    ],
  }
}

/** The four business menus this distribution publishes, in menu order. */
export const DIRECTORY_GROUPS: readonly DirectoryGroupSpec[] = [
  {
    id: 'suixing.ai-staff',
    order: 10,
    titleKey: 'group.agents',
    hintKey: 'group.agents.hint',
    panelId: AGENTS_PANEL,
    manageable: true,
    // Plan §2: nine agents, one menu. The four creation tools used to share
    // this list; they now own 创作中心, so each menu names one kind of work.
    // 总裁决策官 carries its own richer detail page (see CHIEF above).
    entries: AGENT_IDS.map(id => (id === 'chief' ? CHIEF : agent(id))),
  },
  {
    id: 'suixing.automation',
    order: 20,
    titleKey: 'group.automation',
    hintKey: 'group.automation.hint',
    panelId: AUTOMATION_PANEL,
    manageable: true,
    entries: WORKFLOW_IDS.map(workflow),
  },
  {
    id: 'suixing.projects',
    order: 30,
    titleKey: 'group.projects',
    hintKey: 'group.projects.hint',
    panelId: PROJECTS_PANEL,
    manageable: true,
    // Prototype §5: 项目管理 is parallel to the two business centers. The
    // concrete project model (per-project isolation, unsent drafts) comes with
    // the platform project/workspace API; one planning entry ships first.
    entries: PROJECT_IDS.map(project),
  },
  {
    id: 'suixing.creation',
    order: 40,
    titleKey: 'group.creation',
    hintKey: 'group.creation.hint',
    panelId: CREATION_PANEL,
    manageable: true,
    // 老谢 2026-09-20: 创作中心 sits below 项目管理 and holds the four
    // creation capabilities. It behaves like the other centres — same manage
    // surface, same one-sentence drafting — and each capability additionally
    // names a platform call it can be pointed at (bridges/spec.ts).
    entries: CREATION_IDS.map(creation),
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
