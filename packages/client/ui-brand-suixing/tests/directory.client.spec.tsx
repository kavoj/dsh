// @vitest-environment jsdom
/**
 * The SuiXing capability directory: the four business menus of the plan's §2.1
 * decision arrive as data — a catalog group the sidebar shell renders, the main
 * panel its "view all" opens, and the page definitions those panels show. The
 * dictionaries carry the prototype's own copy, so the tests read what the
 * product approved rather than what implementation invented.
 *
 * 创作中心 (老谢 2026-09-20) is covered here twice: as a menu that ships its own
 * four capabilities, and as the one menu whose cards say where each capability
 * runs — locally, or through a platform socket.
 *
 * The detail page is covered the same way the prototype draws it: a sidebar
 * entry and a card are one navigation that lands on the capability itself, and
 * the page behind it carries the definition rows plus the two facts a card
 * cannot hold — where it runs and what starts it.
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ILayout, MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSidebarCatalog } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject } from '../src/client/index.ts'
import type { BridgeConfig } from '../src/client/bridges/spec.ts'
import type { AgentSpec, WorkflowSpec } from '../src/client/centers/spec.ts'
import type { CentersSnapshot } from '../src/client/centers/store.ts'
import { DirectoryPage, type DirectoryPageProps } from '../src/client/directory/DirectoryPage.tsx'
import {
  AGENTS_PANEL, AUTOMATION_PANEL, PROJECTS_PANEL, CREATION_PANEL,
  DIRECTORY_GROUPS, directoryGroup, type DirectoryGroupSpec,
} from '../src/client/directory/specs.ts'
import { DIRECTORY_NS, directoryEn, directoryZh } from '../src/client/directory/locales.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  localStorage.clear()
})

/** Translate stub over one dictionary, template params substituted. */
function translate(dict: Record<string, string>): DirectoryPageProps['t'] {
  return (key, params) => {
    const template = dict[key] ?? key
    if (params === undefined) return template
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template,
    )
  }
}

/** English-dictionary translate stub. */
const t = translate(directoryEn)

/** Chinese-dictionary translate stub, for the prototype-copy assertions. */
const zhT = translate(directoryZh)

/** The groups the prototypes define, by their stable ids. */
const AGENTS = directoryGroup('suixing.ai-staff') as DirectoryGroupSpec
const AUTOMATION = directoryGroup('suixing.automation') as DirectoryGroupSpec
const CREATION = directoryGroup('suixing.creation') as DirectoryGroupSpec

/** A connection configuration handed straight to the page, as a hook. */
function configHook(config: BridgeConfig) {
  return function useBridges<Selected>(select: (snapshot: BridgeConfig) => Selected): Selected {
    return select(config)
  }
}

/** A focused capability handed straight to the page, as a hook. */
function focusHook(id: string | null) {
  return function useFocus<Selected>(select: (snapshot: string | null) => Selected): Selected {
    return select(id)
  }
}

/** A centres configuration handed straight to the page, as a hook. */
function centersHook(snapshot: CentersSnapshot) {
  return function useCenters<Selected>(select: (value: CentersSnapshot) => Selected): Selected {
    return select(snapshot)
  }
}

/** The panel selector the directory navigates with, as ui-layout exposes it. */
function fakeLayout(selectPanel: (panelId: MainPanelId | null) => void): ILayout {
  return {
    selectPanel,
    beginNavigation: () => new AbortController().signal,
    toggleSidebar: vi.fn(),
    openRightbar: vi.fn(),
    closeRightbar: vi.fn(),
  }
}

/** An agent the architect built on this machine, as the detail page reads it. */
const LOCAL_AGENT: AgentSpec = {
  id: 'local.agent.1',
  name: '面料合规顾问',
  oneLiner: '按国标看成分与标识。',
  role: 'specialist',
  rolePrompt: '你是纺织面料合规顾问，只依据国标回答成分与标识问题。',
  guardrails: ['不给出法律结论'],
  tools: ['knowledge'],
  datasets: [],
  openingStatement: '把面料成分表发我，我按国标读一遍。',
  starters: ['这个成分可以标全棉吗？'],
  inputs: [{ key: 'fabric', label: '面料成分', required: true }],
  outputContract: '一份合规意见',
  assumptions: ['默认按 GB/T 29862 读标识'],
}

/** A workflow the architect built on this machine. */
const LOCAL_FLOW: WorkflowSpec = {
  id: 'local.flow.1',
  name: '经营周报流水线',
  oneLiner: '把一周数据整理成周报。',
  scope: 'private',
  steps: [
    { stepKey: 'collect', name: '汇总数据', prompt: '汇总本周经营数据', kind: 'text' },
    { stepKey: 'write', name: '写周报', prompt: '按结论写一份周报', kind: 'text' },
  ],
  assumptions: ['默认按自然周汇总'],
}

/**
 * A cordis bench carrying the four services the plugin injects: the slot
 * registry with the seats ui-layout declares, the locale runtime, a real
 * sidebar catalog the plugin publishes into, and the panel selector.
 */
async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: {
      'sidebar.brand.mark': { kind: 'single', scope: 'root' },
      'sidebar.brand.name': { kind: 'single', scope: 'root' },
      main: { kind: 'keyed', scope: 'root' },
    },
  } as never, () => null)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const catalog = createSidebarCatalog(() => {})
  ctx.provide('sidebarCatalog', catalog)
  const selectPanel = vi.fn()
  ctx.provide('layout', fakeLayout(selectPanel))
  return { ctx, slots, catalog, selectPanel }
}

describe('SuiXing capability directory — published data', () => {
  it('declares only the services it uses', () => {
    expect(inject).toEqual(['locale', 'slots', 'sidebarCatalog', 'layout'])
  })

  it('publishes the four business menus and the panels behind their "view all"', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'suixing')
    const subject = await bench()
    const fiber = subject.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const snapshot = subject.catalog.getSnapshot()
    expect(snapshot.claimed).toBe(true)
    expect(snapshot.status).toBe('ready')
    expect(snapshot.groups.map(view => view.group.id)).toEqual([
      'suixing.ai-staff', 'suixing.automation', 'suixing.projects', 'suixing.creation',
    ])
    const [agents, automation, , creation] = snapshot.groups
    // The runtime's locale decides the wording; both dictionaries carry it.
    expect([directoryZh['group.agents'], directoryEn['group.agents']]).toContain(agents?.group.title)
    expect([directoryZh['group.agents.hint'], directoryEn['group.agents.hint']])
      .toContain(agents?.group.hint)
    expect(agents?.group.allPanel).toBe(AGENTS_PANEL)
    expect(automation?.group.allPanel).toBe(AUTOMATION_PANEL)
    expect(creation?.group.allPanel).toBe(CREATION_PANEL)
    expect([directoryZh['group.creation'], directoryEn['group.creation']])
      .toContain(creation?.group.title)
    // The menu lists every declared capability (the prototype lists all nine
    // agents in the menu), while each group holds its own: nine agents, four
    // scenarios, one project note, four creations.
    expect(agents?.visible).toHaveLength(9)
    expect(agents?.total).toBe(9)
    expect(automation?.total).toBe(4)
    expect(creation?.total).toBe(4)
    // Every entry navigates: it focuses the capability and selects the menu's
    // panel, so the sidebar lands on the capability rather than on the list.
    for (const view of snapshot.groups) {
      for (const entry of view.group.entries) expect(entry.target.kind).toBe('command')
    }
    expect(subject.slots.entries('main').map(entry => entry.options.key))
      .toEqual([AGENTS_PANEL, AUTOMATION_PANEL, PROJECTS_PANEL, CREATION_PANEL])
    // A first run opens one menu, so the region is never a wall of headers.
    expect(snapshot.groups.map(view => view.expanded)).toEqual([true, false, false, false])

    // Activating an entry is the navigation itself: one panel selection, and
    // the focus the panel reads.
    const image = creation?.group.entries.find(entry => entry.id === 'image')
    if (image?.target.kind !== 'command') throw new Error('the image entry stopped navigating')
    image.target.run()
    expect(subject.selectPanel).toHaveBeenCalledWith(CREATION_PANEL)

    await fiber.dispose()
    expect(subject.catalog.getSnapshot().claimed).toBe(false)
    expect(subject.catalog.getSnapshot().groups).toEqual([])
    expect(subject.slots.entries('main')).toHaveLength(0)
  })

  it('publishes no menu and no panel in the official and local builds', async () => {
    for (const profile of ['official', 'local']) {
      vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', profile)
      const subject = await bench()
      const fiber = subject.ctx.plugin({ inject: [...inject], apply })
      await fiber.await()
      expect(subject.catalog.getSnapshot().groups).toEqual([])
      expect(subject.slots.entries('main')).toHaveLength(0)
      await fiber.dispose()
    }
  })

  it('fills every declared key in both dictionaries', () => {
    expect(DIRECTORY_NS).toBe('suixing-directory')
    const filled = (key: string): boolean => {
      expect(directoryZh[key as keyof typeof directoryZh]?.trim()).not.toBe('')
      expect(directoryEn[key as keyof typeof directoryEn]?.trim()).not.toBe('')
      return true
    }
    for (const group of DIRECTORY_GROUPS) {
      filled(group.titleKey)
      filled(group.hintKey)
      for (const capability of group.entries) {
        filled(capability.labelKey)
        filled(capability.hintKey)
        for (const field of capability.fields) {
          filled(field.termKey)
          filled(field.valueKey)
        }
      }
    }
    // The detail page's own copy, keyed here so a missing line fails loudly.
    for (const key of [
      'page.bridge.title', 'page.bridge.reserved', 'page.bridge.configured',
      'page.open', 'page.open.label', 'detail.crumb', 'detail.back',
      'detail.local.origin', 'detail.local.prompt', 'detail.local.opening',
      'detail.local.starters', 'detail.local.steps', 'detail.local.assumptions',
      'detail.start.agent', 'detail.start.creation', 'detail.start.workflow',
      'detail.start.project', 'detail.start.hint',
      'page.edit', 'page.edit.aria', 'page.edit.title', 'page.edit.hint',
      'page.edit.opening', 'page.edit.opening.hint', 'page.edit.starters',
      'page.edit.starters.hint', 'page.edit.confirm', 'page.edit.cancel',
    ]) filled(key)
  })

  it('keeps capability ids unique across the menus, so recency stays one list', () => {
    const ids = DIRECTORY_GROUPS.flatMap(group => group.entries.map(entry => entry.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(18)
  })
})

describe('SuiXing capability directory — the page', () => {
  it('renders the menu title, its secondary name, and one card per capability', () => {
    render(<DirectoryPage group={AGENTS} t={zhT} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('AI参谋部')
    expect(screen.getByText('Agent中心')).toBeTruthy()
    // The status rides the page banner and marks every capability card.
    expect(screen.getAllByText('首期接入中').length).toBe(10)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(9)
    expect(screen.getByText('共 9 项能力')).toBeTruthy()
  })

  it('renders a capability as its lead line plus the prototype definition rows', () => {
    render(<DirectoryPage group={AGENTS} t={zhT} />)
    expect(screen.getByText('总裁决策官')).toBeTruthy()
    expect(screen.getByText('把眼前的难题，理成下一步。')).toBeTruthy()
    // 总裁决策官's card keeps one row — its self-introduction; the other eight
    // keep the agent template's purpose row.
    expect(screen.getAllByText('用途说明')).toHaveLength(8)
    expect(screen.getByText('自我介绍')).toBeTruthy()
    expect(screen.getByText(/我是总裁决策官，AI参谋部的首席角色/)).toBeTruthy()
  })

  it('introduces 总裁决策官 in full: what it solves, how to use it, what it refuses', () => {
    render(<DirectoryPage group={AGENTS} t={zhT} useFocus={focusHook('chief')} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('总裁决策官')
    // The introduction and the hand-over read as quotations.
    expect(screen.getByText(/我是总裁决策官，AI参谋部的首席角色/)).toBeTruthy()
    expect(screen.getByText(/把背景和诉求直接丢给我/)).toBeTruthy()
    for (const term of ['我能解决', '怎么用', '我能做的', '我不会做的', '决策思维课（跟着学）']) {
      expect(screen.getByText(term)).toBeTruthy()
    }
    // Four named problems; the do-list as chips.
    expect(screen.getByText('问题太模糊，不知道从哪下手')).toBeTruthy()
    expect(screen.getByText('会开了很久，最后没人拍板。')).toBeTruthy()
    expect(screen.getByText('拆问题')).toBeTruthy()
    expect(screen.getByText('出决策清单。')).toBeTruthy()
    // The refusals name their three limits, the lesson names its tools.
    expect(screen.getByText('替你拍板——最终决定权永远在你')).toBeTruthy()
    expect(screen.getByText('代替法务与财务的专业意见——我只做经营视角的拆解。')).toBeTruthy()
    expect(screen.getByText('可逆性分级——可逆的决定快做，不可逆的决定慢做。')).toBeTruthy()
  })

  it('shows a workflow scenario with its own definition rows', () => {
    render(<DirectoryPage group={AUTOMATION} t={zhT} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('自动化工厂')
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4)
    for (const term of ['要准备', '要确认', '预计结果', '页面步骤', '关键提示']) {
      expect(screen.getAllByText(term).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('提供资料 → 审核内容 → 准备发布。')).toBeTruthy()
    expect(screen.getByText('共 4 项能力')).toBeTruthy()
  })

  it('gives 创作中心 its own four capabilities, each saying where it runs', () => {
    render(<DirectoryPage group={CREATION} t={zhT} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('创作中心')
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4)
    expect(screen.getByText('共 4 项能力')).toBeTruthy()
    for (const name of ['PPT生成', '图片生成', '视频制作', '音乐制作']) {
      expect(screen.getByText(name)).toBeTruthy()
    }
    // The creator-confirmation shape, not the agent shape.
    expect(screen.getAllByText('第一轮追问')).toHaveLength(4)
    expect(screen.getAllByText('初步确认项')).toHaveLength(4)
    expect(screen.getByText('图片用在哪里？需要展示什么产品，想让人感受到什么？')).toBeTruthy()
    // With nothing configured, every capability runs here.
    expect(screen.getAllByText('本机完成')).toHaveLength(4)
  })

  it('says which 创作中心 capability the platform runs, and which one is pending', () => {
    const hooked: BridgeConfig = {
      baseUrl: 'https://agent.35sz.top',
      apiKey: '',
      modes: { image: 'platform' },
      endpoints: {},
    }
    render(<DirectoryPage group={CREATION} t={zhT} useBridges={configHook(hooked)} />)
    expect(screen.getAllByText('平台接口')).toHaveLength(1)
    expect(screen.getAllByText('本机完成')).toHaveLength(3)

    // Pointed at the platform without an origin: the page says so rather than
    // presenting an address that would not resolve.
    const pending: BridgeConfig = { baseUrl: '', apiKey: '', modes: { video: 'platform' }, endpoints: {} }
    cleanup()
    render(<DirectoryPage group={CREATION} t={zhT} useBridges={configHook(pending)} />)
    expect(screen.getByText('接口待配置')).toBeTruthy()
    expect(screen.getAllByText('本机完成')).toHaveLength(3)
  })

  it('filters by name and by lead line, and says so when nothing matches', () => {
    render(<DirectoryPage group={AGENTS} t={zhT} />)
    const search = screen.getByRole('searchbox', { name: '在本目录中搜索' })
    fireEvent.change(search, { target: { value: '法务' } })
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    expect(screen.getByText('法务智能体')).toBeTruthy()
    expect(screen.getByText('共 1 项能力')).toBeTruthy()

    // The lead line is part of the match, not just the name.
    fireEvent.change(search, { target: { value: '井井有条' } })
    expect(screen.getByText('超级助理')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)

    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
    expect(screen.getByText('没有匹配的能力。')).toBeTruthy()
    expect(screen.getByText('共 0 项能力')).toBeTruthy()
  })

  it('reads the English dictionary through the same spec', () => {
    render(<DirectoryPage group={AUTOMATION} t={t} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Automation Factory')
    expect(screen.getByText('WorkFlow center')).toBeTruthy()
    expect(screen.getByText('Xiaohongshu Content Batch')).toBeTruthy()
    expect(screen.getByText('4 capabilities')).toBeTruthy()
  })

  it('serves a group directory from its panel key through the production renderer', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'suixing')
    const runtime = await SlotTestRuntime.create()
    try {
      const locale = new LocaleRuntime(runtime.ctx)
      locale.setLocale('zh')
      const catalog = createSidebarCatalog(vi.fn())
      await runtime.mount({
        inject: ['slots'],
        apply(ctx: Context) {
          ctx.provide('locale', locale)
          ctx.provide('sidebarCatalog', catalog)
          ctx.provide('layout', fakeLayout(vi.fn()))
          ctx.slots.installLocale(locale)
        },
      })
      // ui-layout owns this shape: one keyed main entry per registered panel.
      function Frame({ renderSlot }: PropsRenderSlots<'main'>) {
        return <>{renderSlot('main', {}, { entryKey: AGENTS_PANEL })}</>
      }
      await runtime.root.declare({ main: { kind: 'keyed', scope: 'root' } }, Frame)
      await runtime.mount({ inject: [...inject], apply })
      runtime.renderRoot()

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('AI参谋部')
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(9)
      expect(catalog.getSnapshot().groups.map(view => view.group.allPanel))
        .toEqual([AGENTS_PANEL, AUTOMATION_PANEL, PROJECTS_PANEL, CREATION_PANEL])
    } finally {
      await runtime.dispose()
    }
  })
})

describe('SuiXing capability directory — one capability in full', () => {
  it('opens a capability from its card', () => {
    const focusCapability = vi.fn()
    render(<DirectoryPage group={CREATION} t={zhT} focusCapability={focusCapability} />)
    fireEvent.click(screen.getByRole('button', { name: '查看 PPT生成 的能力详情' }))
    expect(focusCapability).toHaveBeenCalledWith('ppt')
  })

  it('lays a creation capability out the way the prototype does', () => {
    render(<DirectoryPage group={CREATION} t={zhT} useFocus={focusHook('ppt')} />)
    // The page replaces the list rather than sitting beside it.
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('PPT生成')
    expect(screen.getByText('先把思路讲清，再做成演示。')).toBeTruthy()
    expect(screen.getByText('创作中心')).toBeTruthy()
    // 第一轮追问 reads as a quotation…
    expect(screen.getByText('这份PPT给谁看？看完后，你最希望对方记住什么或做出什么决定？')).toBeTruthy()
    // …the three quick tasks as chips…
    for (const task of ['做一份品牌介绍', '准备经营复盘汇报', '整理招商合作方案。']) {
      expect(screen.getByText(task)).toBeTruthy()
    }
    // …and the remaining rows as prose.
    expect(screen.getByText('面向谁、页数、视觉风格。')).toBeTruthy()
    expect(screen.getByText('支持从一句话开始，也可补充文档与品牌资料。')).toBeTruthy()
  })

  it('says where a creation capability runs, and what starts it', () => {
    const hooked: BridgeConfig = {
      baseUrl: 'https://agent.35sz.top',
      apiKey: '',
      modes: { image: 'platform' },
      endpoints: {},
    }
    render(
      <DirectoryPage group={CREATION} t={zhT} useFocus={focusHook('image')}
        useBridges={configHook(hooked)} />,
    )
    expect(screen.getByText('能力接入点')).toBeTruthy()
    expect(screen.getByText('平台接口')).toBeTruthy()
    expect(screen.getByText('POST')).toBeTruthy()
    expect(screen.getByText('https://agent.35sz.top/openapi/v1/generations/image')).toBeTruthy()
    expect(screen.getByText(/由「设置 → 随星能力接入」配置/)).toBeTruthy()

    // Nothing configured: the address is the socket's reserved default path, and
    // the page says the platform rung is not in use yet.
    cleanup()
    render(<DirectoryPage group={CREATION} t={zhT} useFocus={focusHook('music')} />)
    expect(screen.getByText('本机完成')).toBeTruthy()
    expect(screen.getByText('/openapi/v1/generations/mv')).toBeTruthy()
    expect(screen.getByText(/预留，未启用/)).toBeTruthy()
  })

  it('walks back to the list and starts work for the focused capability', () => {
    const clearFocus = vi.fn()
    const startCapability = vi.fn()
    render(
      <DirectoryPage group={AGENTS} t={zhT} useFocus={focusHook('legal')}
        clearFocus={clearFocus} startCapability={startCapability} />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('法务智能体')
    fireEvent.click(screen.getByRole('button', { name: /返回目录/ }))
    expect(clearFocus).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '开始对话' }))
    // The page hands over the capability it is showing; the registration decides
    // whether that becomes a real conversation or just a panel switch.
    expect(startCapability).toHaveBeenCalledTimes(1)
    expect(startCapability).toHaveBeenCalledWith('legal')
  })

  it('edits a locally built agent from its card and saves through the injected update', () => {
    const updateAgent = vi.fn()
    const snapshot: CentersSnapshot = {
      source: 'local', remoteBaseUrl: '', agents: [LOCAL_AGENT], workflows: [],
    }
    render(
      <DirectoryPage group={AGENTS} t={zhT} useCenters={centersHook(snapshot)}
        updateAgent={updateAgent} />,
    )
    // Shipped cards carry no edit door; the local one does.
    expect(screen.queryByRole('button', { name: '编辑 总裁决策官 的配置与提示词' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '编辑 面料合规顾问 的配置与提示词' }))
    expect(screen.getByText('编辑智能体')).toBeTruthy()
    // The form opens pre-filled with what the agent carries today.
    expect(screen.getByDisplayValue(LOCAL_AGENT.rolePrompt)).toBeTruthy()
    expect(screen.getByDisplayValue(LOCAL_AGENT.openingStatement)).toBeTruthy()
    expect(screen.getByDisplayValue('这个成分可以标全棉吗？')).toBeTruthy()

    fireEvent.change(screen.getByDisplayValue('面料合规顾问'), {
      target: { value: '面料合规顾问·新版' },
    })
    fireEvent.change(screen.getByDisplayValue(LOCAL_AGENT.rolePrompt), {
      target: { value: '只回答成分与标识，其余一律转介。' },
    })
    fireEvent.click(screen.getByText('保存'))
    expect(updateAgent).toHaveBeenCalledTimes(1)
    const [id, draft] = updateAgent.mock.calls[0] as [string, Record<string, unknown>]
    expect(id).toBe(LOCAL_AGENT.id)
    expect(draft).toMatchObject({
      name: '面料合规顾问·新版',
      rolePrompt: '只回答成分与标识，其余一律转介。',
      openingStatement: LOCAL_AGENT.openingStatement,
      starters: ['这个成分可以标全棉吗？'],
    })
  })

  it('keeps the edit door out of menus that hold no local agents', () => {
    const snapshot: CentersSnapshot = {
      source: 'local', remoteBaseUrl: '', agents: [LOCAL_AGENT], workflows: [],
    }
    render(<DirectoryPage group={AUTOMATION} t={zhT} useCenters={centersHook(snapshot)} />)
    expect(screen.queryByText('编辑智能体')).toBeNull()
    expect(screen.queryByRole('button', { name: /编辑 .* 的配置与提示词/ })).toBeNull()
  })

  it('opens the same edit form from an agent detail page, over the detail view', () => {
    const snapshot: CentersSnapshot = {
      source: 'local', remoteBaseUrl: '', agents: [LOCAL_AGENT], workflows: [],
    }
    render(
      <DirectoryPage group={AGENTS} t={zhT} useFocus={focusHook(LOCAL_AGENT.id)}
        useCenters={centersHook(snapshot)} updateAgent={vi.fn()} />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('面料合规顾问')
    fireEvent.click(screen.getByText('编辑'))
    // The modal mounts even though the detail page replaced the list.
    expect(screen.getByText('编辑智能体')).toBeTruthy()
    expect(screen.getByDisplayValue(LOCAL_AGENT.rolePrompt)).toBeTruthy()
  })

  it('deletes a locally built agent from its card, behind a confirm', () => {
    const removeAgent = vi.fn()
    const snapshot: CentersSnapshot = {
      source: 'local', remoteBaseUrl: '', agents: [LOCAL_AGENT], workflows: [],
    }
    render(
      <DirectoryPage group={AGENTS} t={zhT} useCenters={centersHook(snapshot)}
        removeAgent={removeAgent} />,
    )
    // Shipped cards carry no delete door; the local one does.
    expect(screen.queryByRole('button', { name: '删除 总裁决策官' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '删除 面料合规顾问' }))
    expect(screen.getByText('删除智能体')).toBeTruthy()
    expect(screen.getByText(/将从 Agent中心 与侧栏移除/)).toBeTruthy()
    // The confirm — not the card's own button — performs the removal.
    fireEvent.click(screen.getAllByRole('button', { name: '删除' }).at(-1) as HTMLElement)
    expect(removeAgent).toHaveBeenCalledTimes(1)
    expect(removeAgent).toHaveBeenCalledWith(LOCAL_AGENT.id)
  })

  it('cancels the delete confirm and keeps the agent', () => {
    const removeAgent = vi.fn()
    const snapshot: CentersSnapshot = {
      source: 'local', remoteBaseUrl: '', agents: [LOCAL_AGENT], workflows: [],
    }
    render(
      <DirectoryPage group={AGENTS} t={zhT} useCenters={centersHook(snapshot)}
        removeAgent={removeAgent} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '删除 面料合规顾问' }))
    fireEvent.click(screen.getByText('取消'))
    expect(screen.queryByText('删除智能体')).toBeNull()
    expect(removeAgent).not.toHaveBeenCalled()
  })

  it('offers the same delete door from an agent detail page', () => {
    const removeAgent = vi.fn()
    const snapshot: CentersSnapshot = {
      source: 'local', remoteBaseUrl: '', agents: [LOCAL_AGENT], workflows: [],
    }
    render(
      <DirectoryPage group={AGENTS} t={zhT} useFocus={focusHook(LOCAL_AGENT.id)}
        useCenters={centersHook(snapshot)} removeAgent={removeAgent} />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('面料合规顾问')
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0] as HTMLElement)
    expect(screen.getByText('删除智能体')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: '删除' }).at(-1) as HTMLElement)
    expect(removeAgent).toHaveBeenCalledWith(LOCAL_AGENT.id)
  })

  it('keeps the delete door out of menus that hold no local agents', () => {
    const snapshot: CentersSnapshot = {
      source: 'local', remoteBaseUrl: '', agents: [LOCAL_AGENT], workflows: [],
    }
    render(<DirectoryPage group={AUTOMATION} t={zhT} useCenters={centersHook(snapshot)}
      removeAgent={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /删除 / })).toBeNull()
  })

  it('shows what the architect built: prompt, opening line, starters, assumptions', () => {
    const snapshot: CentersSnapshot = {
      source: 'local', remoteBaseUrl: '', agents: [LOCAL_AGENT], workflows: [],
    }
    render(
      <DirectoryPage group={AGENTS} t={zhT} useFocus={focusHook(LOCAL_AGENT.id)}
        useCenters={centersHook(snapshot)} />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('面料合规顾问')
    expect(screen.getByText('本地')).toBeTruthy()
    expect(screen.getByText('在「设置 → 随星业务中心」用一句话创建，改动会同步到侧栏。')).toBeTruthy()
    expect(screen.getByText('系统提示词')).toBeTruthy()
    expect(screen.getByText(LOCAL_AGENT.rolePrompt)).toBeTruthy()
    expect(screen.getByText('开场白')).toBeTruthy()
    expect(screen.getByText(LOCAL_AGENT.openingStatement)).toBeTruthy()
    expect(screen.getByText('引导问题')).toBeTruthy()
    expect(screen.getByText('这个成分可以标全棉吗？')).toBeTruthy()
    expect(screen.getByText('参谋官替你做的假设')).toBeTruthy()
    expect(screen.getByText('默认按 GB/T 29862 读标识')).toBeTruthy()
  })

  it('shows a locally built workflow as its pipeline', () => {
    const snapshot: CentersSnapshot = {
      source: 'local', remoteBaseUrl: '', agents: [], workflows: [LOCAL_FLOW],
    }
    render(
      <DirectoryPage group={AUTOMATION} t={zhT} useFocus={focusHook(LOCAL_FLOW.id)}
        useCenters={centersHook(snapshot)} />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('经营周报流水线')
    expect(screen.getByText('流水线步骤')).toBeTruthy()
    for (const step of ['汇总数据', '写周报']) expect(screen.getByText(step)).toBeTruthy()
    expect(screen.getByRole('button', { name: '开始任务' })).toBeTruthy()
  })

  it('keeps the list when the focused id belongs to another menu', () => {
    render(<DirectoryPage group={AGENTS} t={zhT} useFocus={focusHook('ppt')} />)
    expect(screen.getByRole('searchbox')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(9)
  })
})
