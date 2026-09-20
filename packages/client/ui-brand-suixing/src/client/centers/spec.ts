/**
 * Business-centre specs and the local architect that drafts them.
 *
 * The platform's agent row is complete but hand-filled: the user is expected to
 * write the prompt. This module is the missing first step of the A2A ladder —
 * a *draft* produced from one line of intent, carrying every field the platform
 * needs plus the assumptions the architect had to make, so the user reviews a
 * structured proposal instead of a blank form.
 *
 * Everything here is a pure function of the user's words: no model call, no
 * clock, no random. That keeps the ladder's first rung testable and offline,
 * and leaves the remote rung (a platform-side generator) as a drop-in peer.
 *
 * The questions come back as *slots*, not sentences: the page localizes them
 * with its own dictionary, so the drafts carry generated text while the
 * interrogation stays chrome.
 */
import { domainProfile, type Domain } from './profiles.ts'

/** What a drafted agent is for, which drives its shape and defaults. */
export type AgentRole = 'specialist' | 'assistant' | 'operator'

/** The delivery form a drafted workflow ends in. */
export type OutputKind = 'doc' | 'slides' | 'image' | 'video' | 'table' | 'report' | 'message'

/** Every delivery form, in the order the picker offers them. */
export const OUTPUT_KINDS: readonly OutputKind[] = [
  'doc', 'slides', 'image', 'video', 'table', 'report', 'message',
]

/** One input variable a capability asks for before it runs (`formFields`). */
export interface SpecInput {
  /** Variable key, referenced as `{{key}}` in the prompt. */
  readonly key: string
  /** Human label shown on the input form. */
  readonly label: string
  /** Whether the capability refuses to start without it. */
  readonly required: boolean
}

/** One agent definition, shaped to map onto the platform's `ai_agent` row. */
export interface AgentSpec {
  /** Local stable id; the settings list and the sidebar entry share it. */
  readonly id: string
  /** Agent name; unique on the platform, so a push checks it first. */
  readonly name: string
  /** One-line promise, shown as the directory hint (`description`). */
  readonly oneLiner: string
  /** The shape this agent was drafted as. */
  readonly role: AgentRole
  /** The system prompt (`rolePrompt`). */
  readonly rolePrompt: string
  /** Rules the agent must not cross; folded into the prompt's constraints. */
  readonly guardrails: readonly string[]
  /** Built-in tool ids this agent needs (`builtInTools`/`toolConfig`). */
  readonly tools: readonly string[]
  /** Knowledge-base ids it reads (`datasetIds`). */
  readonly datasets: readonly string[]
  /** First message it opens with (`openingStatement`). */
  readonly openingStatement: string
  /** Starter questions offered beside the composer (`openingQuestions`). */
  readonly starters: readonly string[]
  /** Input variables it collects (`formFields`). */
  readonly inputs: readonly SpecInput[]
  /** What "done" looks like for this agent; folded into the prompt. */
  readonly outputContract: string
  /** What the architect had to assume — the review list before saving. */
  readonly assumptions: readonly string[]
  /** Platform id, once the spec has been created remotely. */
  readonly remoteId?: string
}

/** One workflow step, shaped for `creator_workflow_node`. */
export interface WorkflowStepSpec {
  /** Stable step key (`stepKey`). */
  readonly stepKey: string
  /** Step name as the factory page lists it. */
  readonly name: string
  /** What this step asks its bound agent for. */
  readonly prompt: string
  /** Medium the step produces (`params.kind`). */
  readonly kind: 'text' | 'vision' | 'image'
  /** How many variants the step produces (`params.count`). */
  readonly count?: number
  /** Frame ratio for image steps (`params.aspectRatio`). */
  readonly aspectRatio?: string
}

/** One workflow definition, shaped for `creator_workflow`. */
export interface WorkflowSpec {
  /** Local stable id. */
  readonly id: string
  /** Workflow name. */
  readonly name: string
  /** One-line promise, shown as the directory hint. */
  readonly oneLiner: string
  /** Whether the platform shares it (`creator_workflow.scope`). */
  readonly scope: 'system' | 'private'
  /** Ordered steps. */
  readonly steps: readonly WorkflowStepSpec[]
  /** What the architect had to assume. */
  readonly assumptions: readonly string[]
  /** Platform id, once created remotely. */
  readonly remoteId?: string
}

/** A drafted agent, before the store gives it an id. */
export type AgentDraft = Omit<AgentSpec, 'id' | 'remoteId'>

/** A drafted workflow, before the store gives it an id. */
export type WorkflowDraft = Omit<WorkflowSpec, 'id' | 'remoteId'>

/** The one slot a clarifying question fills. */
export type ClarifySlot = 'audience' | 'outputs' | 'forbidden'

/** Answers the user gave to the clarifying questions, keyed by slot. */
export interface ClarifyAnswers {
  /** Who the work is for; absent means the architect assumed one. */
  readonly audience?: string
  /** Delivery forms the user asked for; absent means inferred from the line. */
  readonly outputs?: readonly OutputKind[]
  /** Things the agent must not do. */
  readonly forbidden?: string
}

/** Display names for the delivery forms, shared by drafts and the copy. */
const OUTPUT_LABELS: Record<OutputKind, string> = {
  doc: '文档',
  slides: '演示文稿',
  image: '图片',
  video: '视频',
  table: '表格',
  report: '分析报告',
  message: '话术与消息',
}

/**
 * Delivery form of one kind, as copy.
 * @param kind - delivery form.
 * @returns its display name.
 */
export function outputLabel(kind: OutputKind): string {
  return OUTPUT_LABELS[kind]
}

/** Keyword → delivery form. Longest-first so "短视频" beats "视频". */
const OUTPUT_HINTS: readonly (readonly [string, OutputKind])[] = [
  ['短视频', 'video'], ['视频', 'video'], ['口播', 'video'],
  ['小红书', 'message'], ['话术', 'message'], ['邮件', 'message'], ['回复', 'message'], ['文案', 'message'],
  ['ppt', 'slides'], ['PPT', 'slides'], ['演示', 'slides'], ['汇报材料', 'slides'], ['路演', 'slides'],
  ['海报', 'image'], ['主图', 'image'], ['封面', 'image'], ['配图', 'image'], ['图片', 'image'],
  ['表格', 'table'], ['清单', 'table'], ['台账', 'table'],
  ['报告', 'report'], ['周报', 'report'], ['月报', 'report'], ['日报', 'report'], ['分析', 'report'],
  ['文档', 'doc'], ['方案', 'doc'], ['合同', 'doc'], ['制度', 'doc'], ['手册', 'doc'], ['纪要', 'doc'],
]

/**
 * Read intent out of the user's one line: which business domain it belongs to
 * and which delivery forms it names.
 * @param idea - the user's words, verbatim.
 * @returns the domain and the delivery forms, in the order they were named.
 */
export function readIntent(idea: string): { domain: Domain; outputs: readonly OutputKind[] } {
  const text = idea.toLowerCase()
  const outputs: OutputKind[] = []
  for (const [keyword, kind] of OUTPUT_HINTS) {
    if (text.includes(keyword.toLowerCase()) && !outputs.includes(kind)) outputs.push(kind)
  }
  return { domain: domainProfile(text).domain, outputs }
}

/**
 * Audience keywords → the label a draft uses for them. Most specific first, so
 * «给客户看» reads as customers rather than as an internal audience.
 */
const AUDIENCE_HINTS: readonly (readonly [string, string])[] = [
  ['客户', '客户'], ['甲方', '客户'], ['买家', '客户'], ['经销商', '客户'],
  ['管理层', '管理层'], ['高管', '管理层'], ['领导', '管理层'], ['老板', '管理层'], ['董事会', '管理层'],
  ['投资人', '投资人'], ['股东', '投资人'],
  ['学员', '学员'], ['学生', '学员'],
  ['粉丝', '读者与粉丝'], ['读者', '读者与粉丝'], ['用户', '用户'],
  ['员工', '公司员工'], ['同事', '内部同事'], ['团队', '内部同事'], ['内部', '内部同事'],
  ['对外', '外部受众'],
]

/**
 * The audience a sentence names, if it names one.
 *
 * This is what keeps a draft honest: asking the user a question the sentence
 * already answered, and then reporting the answer as an assumption, reads as
 * not having listened. One reader serves both the interrogation and the
 * assumption list.
 * @param idea - the user's words.
 * @returns the audience label, or undefined when the sentence leaves it open.
 */
export function readAudience(idea: string): string | undefined {
  const text = idea.toLowerCase()
  for (const [keyword, label] of AUDIENCE_HINTS) if (text.includes(keyword)) return label
  return undefined
}

/**
 * The clarifying questions still worth asking, at most three.
 * The architect asks only for the slots the line left open, so a detailed idea
 * gets drafted immediately instead of being interrogated.
 * @param idea - the user's words.
 * @param answers - what the user has already answered.
 * @returns the outstanding slots, most important first.
 */
export function clarifyQuestions(idea: string, answers: ClarifyAnswers = {}): readonly ClarifySlot[] {
  const { outputs } = readIntent(idea)
  const text = idea.toLowerCase()
  const slots: ClarifySlot[] = []
  // Audience first: it moves the tone and depth of everything downstream.
  if (answers.audience === undefined && readAudience(idea) === undefined) {
    slots.push('audience')
  }
  if (answers.outputs === undefined && outputs.length === 0) {
    slots.push('outputs')
  }
  if (answers.forbidden === undefined && !/不能|禁止|必须|合规|规范|禁区/u.test(text)) {
    slots.push('forbidden')
  }
  return slots.slice(0, 3)
}

/**
 * Draft one agent from a line of intent.
 * @param idea - the user's words, verbatim.
 * @param answers - answers to the clarifying questions, when any were asked.
 * @returns the draft, carrying every field the platform needs plus the
 * assumptions the user should review.
 */
export function draftAgentSpec(idea: string, answers: ClarifyAnswers = {}): AgentDraft {
  const { outputs } = readIntent(idea)
  const profile = domainProfile(idea)
  // An audience the sentence named is not an assumption: it is a reading, and
  // the reader is the same one the questions came from.
  const named = readAudience(idea)
  const audience = answers.audience ?? named ?? '内部同事'
  const forms = answers.outputs ?? (outputs.length > 0 ? outputs : ['doc'] as const)
  const assumptions: string[] = []
  if (answers.audience === undefined && named === undefined) {
    assumptions.push(`未确认受众，暂按「${audience}」设计`)
  }
  if (answers.outputs === undefined && outputs.length === 0) {
    assumptions.push('未确认交付形式，暂按「文档」设计')
  }
  const guardrails = [
    ...profile.guardrails,
    ...(answers.forbidden === undefined ? [] : [answers.forbidden]),
  ]
  const outputContract = forms.map(kind => OUTPUT_LABELS[kind]).join('、')
  const name = `${profile.role}·${idea.trim().slice(0, 12) || '未命名'}`
  const rolePrompt = [
    `你是「${profile.role}」，${profile.mission}`,
    `当前任务：${idea.trim()}`,
    `服务对象：${audience}`,
    '',
    '职责：',
    ...profile.duties.map(duty => `- ${duty}`),
    '',
    '工作方式：',
    '- 先确认目标与约束，再给方案；信息不足时先问，不要臆测。',
    '- 结论先行，关键判断给出依据；不确定的地方明确标注。',
    '',
    '约束：',
    ...guardrails.map(rule => `- ${rule}`),
    '',
    `交付形态：${outputContract}`,
  ].join('\n')
  return {
    name,
    oneLiner: `${profile.mission}（面向${audience}，交付${outputContract}）`,
    role: profile.agentRole,
    rolePrompt,
    guardrails,
    tools: [...profile.tools],
    datasets: [],
    openingStatement: `我是${profile.role}。说说你手上这件事，我来出方案。`,
    starters: [...profile.starters],
    inputs: [...profile.inputs],
    outputContract,
    assumptions,
  }
}

/**
 * Draft one workflow from a line of intent.
 * @param idea - the user's words, verbatim.
 * @param answers - answers to the clarifying questions, when any were asked.
 * @returns the draft, with one step per delivery form the line named.
 */
export function draftWorkflowSpec(idea: string, answers: ClarifyAnswers = {}): WorkflowDraft {
  const { outputs } = readIntent(idea)
  const named = readAudience(idea)
  const audience = answers.audience ?? named ?? '内部同事'
  const forms = answers.outputs ?? (outputs.length > 0 ? outputs : ['doc', 'message'] as const)
  const assumptions: string[] = []
  if (answers.audience === undefined && named === undefined) {
    assumptions.push(`未确认受众，暂按「${audience}」设计`)
  }
  if (answers.outputs === undefined && outputs.length === 0) {
    assumptions.push('未确认交付形式，暂按「文档 + 话术」两步设计')
  }
  const steps: WorkflowStepSpec[] = forms.map((kind, index) => ({
    stepKey: `step-${index + 1}`,
    name: OUTPUT_LABELS[kind],
    prompt: `根据主题与上游产出，制作${OUTPUT_LABELS[kind]}，面向${audience}。`,
    kind: kind === 'image' ? 'image' : kind === 'video' ? 'vision' : 'text',
    ...(kind === 'image' ? { count: 4, aspectRatio: '3:4' } : {}),
  }))
  return {
    name: `流水线·${idea.trim().slice(0, 12) || '未命名'}`,
    oneLiner: `面向${audience}的一条流水线：${forms.map(kind => OUTPUT_LABELS[kind]).join(' → ')}`,
    scope: 'private',
    steps,
    assumptions,
  }
}
