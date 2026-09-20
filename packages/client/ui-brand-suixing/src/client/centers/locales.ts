/**
 * `suixing-centers` namespace dictionaries: the business-centre settings page.
 *
 * The drafted specs themselves are not here: their text is generated content
 * the user reviews and edits, not chrome. Localized drafting arrives with the
 * platform-side generator (see the A2A design note).
 */

/** The namespace this page's copy is registered under. */
export const CENTERS_NS = 'suixing-centers'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.title': '随星业务中心',
  'section.hint': '配置 AI 参谋部与自动化工厂：能力从哪来，以及用一句话把它们造出来。',
  'source.label': '能力数据源',
  'source.local': '本地配置',
  'source.remote': '远程平台',
  'source.local.hint': '能力保存在本机，离线可用。',
  'source.remote.hint': '从平台读取智能体与工作流。',
  'remote.url.label': '平台地址',
  'remote.pending': '远程连接将在平台接口就绪后启用，当前仍按本地配置工作。',
  'create.title': '一句话创建',
  'create.hint': '说出你想做的事，先得到一份可审可改的草案，再决定是否保存。',
  'create.field.label': '你的想法',
  'create.placeholder': '例如：帮我审一遍合同里的风险条款',
  'create.agent': '生成智能体草案',
  'create.workflow': '生成工作流草案',
  'clarify.title': '先确认三件事，草案会更贴合',
  'clarify.hint': '答不上来的可以留空，参谋官会替你假设并在草案里标出来。',
  'clarify.audience': '这套东西主要给谁看？',
  'clarify.audience.placeholder': '例如：客户 / 内部同事 / 管理层',
  'clarify.outputs': '你希望最终交付什么形式？',
  'clarify.forbidden': '有没有不能碰的内容，或必须遵守的规范？',
  'clarify.forbidden.placeholder': '例如：不能对外承诺价格',
  'clarify.submit': '用这些答案生成草案',
  'clarify.skip': '跳过，直接生成',
  'draft.title': '草案（可改）',
  'draft.name': '名称',
  'draft.prompt': '系统提示词（可直接修改）',
  'draft.opening': '开场白',
  'draft.starters': '引导问题',
  'draft.steps': '流水线步骤',
  'draft.assumptions': '参谋官替你做的假设，请复核',
  'draft.assumptions.none': '没有需要假设的地方。',
  'draft.save.agent': '保存到 AI 参谋部',
  'draft.save.workflow': '保存到自动化工厂',
  'draft.discard': '放弃草案',
  'list.agents': '本地智能体',
  'list.workflows': '本地工作流',
  'list.empty': '还没有本地创建的能力。',
  'list.remove': '删除',
  'list.remove.aria': '删除“{name}”',
  'list.live': '已进入侧栏，重新加载后仍在。',
} satisfies Record<string, string>

/** The centres namespace key union. */
export type SuiXingCentersKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.title': 'SuiXing business centres',
  'section.hint': 'Configure the AI staff and the automation factory: where capabilities come from, and how to build one from a sentence.',
  'source.label': 'Capability source',
  'source.local': 'Local',
  'source.remote': 'Remote platform',
  'source.local.hint': 'Capabilities live on this machine and work offline.',
  'source.remote.hint': 'Reads agents and workflows from the platform.',
  'remote.url.label': 'Platform URL',
  'remote.pending': 'The remote connection turns on once the platform side is ready; local configuration stays in force until then.',
  'create.title': 'Create from one line',
  'create.hint': 'Describe what you want, review the draft, then decide whether to keep it.',
  'create.field.label': 'Your idea',
  'create.placeholder': 'e.g. Review the risk clauses in this contract',
  'create.agent': 'Draft an agent',
  'create.workflow': 'Draft a workflow',
  'clarify.title': 'Three quick questions make the draft fit',
  'clarify.hint': 'Leave any of them blank if you are unsure — the architect will assume and flag it in the draft.',
  'clarify.audience': 'Who is this for?',
  'clarify.audience.placeholder': 'e.g. Customers / colleagues / leadership',
  'clarify.outputs': 'What should it deliver?',
  'clarify.forbidden': 'Anything it must never do, or rules it must follow?',
  'clarify.forbidden.placeholder': 'e.g. Never promise pricing externally',
  'clarify.submit': 'Draft with these answers',
  'clarify.skip': 'Skip and draft now',
  'draft.title': 'Draft (editable)',
  'draft.name': 'Name',
  'draft.prompt': 'System prompt (editable)',
  'draft.opening': 'Opening line',
  'draft.starters': 'Starter questions',
  'draft.steps': 'Pipeline steps',
  'draft.assumptions': 'Assumptions the architect made — please review',
  'draft.assumptions.none': 'Nothing had to be assumed.',
  'draft.save.agent': 'Save to AI staff',
  'draft.save.workflow': 'Save to automation',
  'draft.discard': 'Discard draft',
  'list.agents': 'Local agents',
  'list.workflows': 'Local workflows',
  'list.empty': 'No locally built capability yet.',
  'list.remove': 'Remove',
  'list.remove.aria': 'Remove {name}',
  'list.live': 'Now in the sidebar, and still there after a reload.',
} satisfies Record<SuiXingCentersKey, string>
