// @vitest-environment jsdom
/**
 * SuiXing business centres: the local architect, its store, the settings page,
 * and the projection that puts what the page builds into the sidebar.
 *
 * The A2A ladder's first rung is deliberately a pure function of the user's
 * words, which is what these tests can pin down exactly: which slots a sentence
 * leaves open, what the draft answers with, and what it admits to assuming.
 * The page tests walk the real flow — ask, answer, review, keep — because the
 * questions are the point, not decoration.
 */
import { useSyncExternalStore } from 'react'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSidebarCatalog } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import { createBridgesService } from '../src/client/bridges/store.ts'
import { CentersSection, type CentersSectionProps } from '../src/client/centers/CentersSection.tsx'
import { CENTERS_NS, en as centersEn, zh as centersZh } from '../src/client/centers/locales.ts'
import { createCentersService, type CentersService, type CentersSnapshot } from '../src/client/centers/store.ts'
import {
  clarifyQuestions, draftAgentSpec, draftWorkflowSpec, outputLabel, OUTPUT_KINDS, readIntent,
} from '../src/client/centers/spec.ts'
import { DIRECTORY_GROUPS, localCapabilities, registerSuiXingDirectory } from '../src/client/directory/index.ts'
import { directoryEn } from '../src/client/directory/locales.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  // The service persists on purpose, and jsdom shares one storage across a
  // file: without this, one test's capability list rehydrates into the next.
  localStorage.clear()
})

/** Translate stub over one dictionary, template params substituted. */
function translate(dict: Record<string, string>): CentersSectionProps['t'] {
  return (key, params) => {
    const template = dict[key] ?? key
    if (params === undefined) return template
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template,
    )
  }
}

/** Chinese-dictionary translate stub. */
const zhT = translate(centersZh)

/** English-dictionary translate stub. */
const enT = translate(centersEn)

/** A selector hook over one live service, exactly as the renderer binds it. */
function centersHook(service: CentersService): SnapshotSelectorHook<CentersSnapshot> {
  return function useCenters<Selected>(select: (snapshot: CentersSnapshot) => Selected): Selected {
    const subscribe = (listener: () => void): (() => void) => service.subscribe(listener)
    return useSyncExternalStore(subscribe, () => select(service.getSnapshot()))
  }
}

/** Render the page over one service, with the actions wired as production does. */
function mountSection(service: CentersService, t: CentersSectionProps['t'] = zhT) {
  return render(
    <CentersSection
      useCenters={centersHook(service)}
      setSource={(source) => { service.setSource(source) }}
      setRemoteBaseUrl={(url) => { service.setRemoteBaseUrl(url) }}
      addAgent={(draft) => { service.addAgent(draft) }}
      removeAgent={(id) => { service.removeAgent(id) }}
      addWorkflow={(draft) => { service.addWorkflow(draft) }}
      removeWorkflow={(id) => { service.removeWorkflow(id) }}
      t={t}
    />,
  )
}

describe('SuiXing business centres — reading intent', () => {
  it('reads the delivery forms a sentence names, longest hint first', () => {
    expect(readIntent('做一条短视频和一张海报').outputs).toEqual(['video', 'image'])
    expect(readIntent('写一份小红书文案').outputs).toEqual(['message'])
    expect(readIntent('没有任何交付形式').outputs).toEqual([])
  })

  it('names every delivery form it can ask about', () => {
    expect(OUTPUT_KINDS).toHaveLength(7)
    for (const kind of OUTPUT_KINDS) expect(outputLabel(kind).trim()).not.toBe('')
  })

  it('asks only for the slots a sentence left open', () => {
    // Nothing answered anywhere: all three slots are open.
    expect(clarifyQuestions('帮我梳理一下获客渠道')).toEqual(['audience', 'outputs', 'forbidden'])
    // Audience and delivery form named, constraint absent: only the constraint is asked.
    expect(clarifyQuestions('给客户做一份分析报告')).toEqual(['forbidden'])
    // Every slot answered in the sentence itself: nothing to ask.
    expect(clarifyQuestions('给管理层做一份汇报 PPT，不能编造数据')).toEqual([])
  })

  it('stops asking once an answer is on the record', () => {
    expect(clarifyQuestions('帮我梳理获客渠道', { audience: '老板' }))
      .toEqual(['outputs', 'forbidden'])
    expect(clarifyQuestions('帮我梳理获客渠道', {
      audience: '老板', outputs: ['doc'], forbidden: '不能承诺价格',
    })).toEqual([])
  })
})

describe('SuiXing business centres — the draft', () => {
  it('carries every field the platform needs, plus its assumptions', () => {
    // The sentence names neither an audience nor a delivery form, so both are
    // recorded as assumptions instead of being presented as the user's choice.
    const draft = draftAgentSpec('帮我审一遍风险条款')
    expect(draft.name).toContain('法务')
    expect(draft.rolePrompt).toContain('你是「')
    expect(draft.rolePrompt).toContain('工作方式：')
    expect(draft.rolePrompt).toContain('交付形态：文档')
    expect(draft.openingStatement.trim()).not.toBe('')
    expect(draft.starters.length).toBeGreaterThan(0)
    // Two slots were left open, so two lines say so rather than the draft
    // pretending the user chose.
    expect(draft.assumptions).toHaveLength(2)
    expect(draft.assumptions.join('\n')).toContain('受众')
    expect(draft.assumptions.join('\n')).toContain('交付形式')
  })

  it('folds the answers in and stops claiming to have assumed them', () => {
    const draft = draftAgentSpec('帮我审一遍合同里的风险条款', {
      audience: '法务同事', outputs: ['doc', 'report'], forbidden: '不能给出正式法律意见',
    })
    expect(draft.assumptions).toEqual([])
    expect(draft.rolePrompt).toContain('服务对象：法务同事')
    expect(draft.rolePrompt).toContain('- 不能给出正式法律意见')
    expect(draft.outputContract).toBe('文档、分析报告')
    expect(draft.oneLiner).toContain('法务同事')
  })

  it('drafts one workflow step per delivery form the sentence named', () => {
    const flow = draftWorkflowSpec('给客户做一批小红书海报')
    expect(flow.steps.map(step => step.name)).toEqual(['话术与消息', '图片'])
    expect(flow.steps[0]?.kind).toBe('text')
    // An image step carries its own params, which is what the platform reads.
    expect(flow.steps[1]).toMatchObject({ kind: 'image', count: 4, aspectRatio: '3:4' })
    expect(flow.scope).toBe('private')
    expect(flow.assumptions).toEqual([])
  })

  it('falls back to a two-step pipeline and says it did', () => {
    const flow = draftWorkflowSpec('帮我梳理获客渠道')
    expect(flow.steps.map(step => step.name)).toEqual(['文档', '话术与消息'])
    expect(flow.assumptions.join('\n')).toContain('交付形式')
  })
})

describe('SuiXing business centres — the store', () => {
  it('starts empty, on the local source, with no platform origin', () => {
    expect(createCentersService().getSnapshot()).toEqual({
      source: 'local', remoteBaseUrl: '', agents: [], workflows: [],
    })
  })

  it('keeps what it is given and hands back the assigned id', () => {
    const centers = createCentersService()
    const agent = centers.addAgent(draftAgentSpec('帮我审一遍合同'))
    const flow = centers.addWorkflow(draftWorkflowSpec('做一批小红书海报'))
    expect(agent.id).toBe('local.agent.1')
    expect(flow.id).toBe('local.flow.1')
    expect(centers.getSnapshot().agents.map(item => item.name)).toEqual([agent.name])
    expect(centers.getSnapshot().workflows).toHaveLength(1)

    centers.removeAgent(agent.id)
    centers.removeWorkflow(flow.id)
    expect(centers.getSnapshot().agents).toEqual([])
    expect(centers.getSnapshot().workflows).toEqual([])
  })

  it('reuses an id only after the entry that held it is gone', () => {
    const centers = createCentersService()
    const first = centers.addAgent(draftAgentSpec('第一件事'))
    centers.addAgent(draftAgentSpec('第二件事'))
    expect(centers.getSnapshot().agents.map(item => item.id)).toEqual(['local.agent.1', 'local.agent.2'])
    centers.removeAgent(first.id)
    // The freed id is taken again, and never shadows a live entry.
    expect(centers.addAgent(draftAgentSpec('第三件事')).id).toBe('local.agent.1')
    expect(new Set(centers.getSnapshot().agents.map(item => item.id)).size).toBe(2)
  })

  it('records where capabilities come from, including the platform origin', () => {
    const centers = createCentersService()
    centers.setSource('remote')
    centers.setRemoteBaseUrl('https://agent.35sz.top')
    expect(centers.getSnapshot().source).toBe('remote')
    expect(centers.getSnapshot().remoteBaseUrl).toBe('https://agent.35sz.top')
  })
})

describe('SuiXing business centres — the settings page', () => {
  it('asks before it drafts, then keeps what the user approves', () => {
    const centers = createCentersService()
    mountSection(centers)

    fireEvent.change(screen.getByPlaceholderText(centersZh['create.placeholder']), {
      target: { value: '帮我梳理一下获客渠道' },
    })
    fireEvent.click(screen.getByText(centersZh['create.agent']))

    // Three slots were open, so the page asks instead of guessing.
    expect(screen.getByText(centersZh['clarify.title'])).toBeTruthy()
    expect(screen.getByText(centersZh['clarify.audience'])).toBeTruthy()
    expect(screen.getByText(centersZh['clarify.outputs'])).toBeTruthy()
    expect(screen.getByText(centersZh['clarify.forbidden'])).toBeTruthy()
    expect(centers.getSnapshot().agents).toEqual([])

    fireEvent.change(screen.getByPlaceholderText(centersZh['clarify.audience.placeholder']), {
      target: { value: '市场同事' },
    })
    fireEvent.click(screen.getByText(outputLabel('report')))
    fireEvent.click(screen.getByText(centersZh['clarify.submit']))

    // The draft arrives with the answers folded in and nothing left assumed.
    expect(screen.getByText(centersZh['draft.title'])).toBeTruthy()
    expect(screen.getByText(centersZh['draft.assumptions.none'])).toBeTruthy()
    const prompt = screen.getByDisplayValue(/你是「/) as HTMLTextAreaElement
    expect(prompt.value).toContain('服务对象：市场同事')
    expect(prompt.value).toContain('交付形态：分析报告')

    fireEvent.click(screen.getByText(centersZh['draft.save.agent']))
    const [kept] = centers.getSnapshot().agents
    expect(kept?.oneLiner).toContain('市场同事')
    expect(screen.getByText(kept?.name ?? '')).toBeTruthy()
    expect(screen.getByText(`${kept?.name ?? ''} · ${centersZh['list.live']}`)).toBeTruthy()
  })

  it('drafts straight away when the sentence already answers everything', () => {
    const centers = createCentersService()
    mountSection(centers)
    fireEvent.change(screen.getByPlaceholderText(centersZh['create.placeholder']), {
      target: { value: '给管理层做一份汇报PPT，不能编造数据' },
    })
    fireEvent.click(screen.getByText(centersZh['create.agent']))
    expect(screen.queryByText(centersZh['clarify.title'])).toBeNull()
    expect(screen.getByText(centersZh['draft.title'])).toBeTruthy()
  })

  it('drafts a workflow too, and lists it with its step chain', () => {
    const centers = createCentersService()
    mountSection(centers)
    fireEvent.change(screen.getByPlaceholderText(centersZh['create.placeholder']), {
      target: { value: '给客户做一批小红书海报' },
    })
    fireEvent.click(screen.getByText(centersZh['create.workflow']))
    fireEvent.click(screen.getByText(centersZh['clarify.skip']))
    fireEvent.click(screen.getByText(centersZh['draft.save.workflow']))
    expect(screen.getByText('话术与消息 → 图片')).toBeTruthy()
    expect(centers.getSnapshot().workflows).toHaveLength(1)
  })

  it('lets a kept capability go again, and says the list is empty', () => {
    const centers = createCentersService()
    centers.addAgent(draftAgentSpec('帮我审一遍合同'))
    mountSection(centers)
    fireEvent.click(screen.getByText(centersZh['list.remove']))
    expect(centers.getSnapshot().agents).toEqual([])
    expect(screen.getAllByText(centersZh['list.empty'])).toHaveLength(2)
  })

  it('switches the capability source and records the platform origin', () => {
    const centers = createCentersService()
    mountSection(centers)
    expect(screen.getByText(centersZh['source.local.hint'])).toBeTruthy()
    fireEvent.click(screen.getByText(centersZh['source.remote']))
    expect(centers.getSnapshot().source).toBe('remote')
    expect(screen.getByText(centersZh['remote.pending'])).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('https://agent.35sz.top'), {
      target: { value: 'https://agent.35sz.top' },
    })
    expect(centers.getSnapshot().remoteBaseUrl).toBe('https://agent.35sz.top')
  })

  it('reads the English dictionary through the same page', () => {
    const centers = createCentersService()
    mountSection(centers, enT)
    expect(screen.getByText(centersEn['section.title'])).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(centersEn['create.placeholder']), {
      target: { value: 'Review the risk clauses in this contract' },
    })
    fireEvent.click(screen.getByText(centersEn['create.agent']))
    expect(screen.getByText(centersEn['clarify.title'])).toBeTruthy()
    expect(screen.getByText(centersEn['clarify.submit'])).toBeTruthy()
  })
})

describe('SuiXing business centres — the sidebar projection', () => {
  /** A bench carrying the services the directory registers against. */
  async function bench() {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: { main: { kind: 'keyed', scope: 'root' } },
    } as never, () => null)
    ctx.provide('locale', new LocaleRuntime(ctx))
    const catalog = createSidebarCatalog(() => {})
    ctx.provide('sidebarCatalog', catalog)
    return { ctx, slots, catalog }
  }

  it('appends what the user built after the shipped entries, by kind', async () => {
    const subject = await bench()
    const centers = createCentersService()
    const fiber = subject.ctx.plugin({
      inject: ['locale', 'slots', 'sidebarCatalog'],
      apply: (ctx: Context) => { registerSuiXingDirectory(ctx, centers, createBridgesService()) },
    })
    await fiber.await()

    const before = subject.catalog.getSnapshot().groups
    // The four shipped centres: nine agents, four scenarios, one project
    // planning entry, and four creations.
    expect(before.map(view => view.total)).toEqual([9, 4, 1, 4])

    const agent = centers.addAgent(draftAgentSpec('帮我审一遍合同里的风险条款'))
    const flow = centers.addWorkflow(draftWorkflowSpec('给客户做一批小红书海报'))

    const after = subject.catalog.getSnapshot().groups
    const [agents, automation, projects, creation] = after
    // Agents land in the AI staff centre, workflows in the automation centre,
    // and 项目管理 / 创作中心 stay as shipped.
    expect(agents?.total).toBe(10)
    expect(automation?.total).toBe(5)
    expect(projects?.total).toBe(1)
    expect(creation?.total).toBe(4)
    expect(agents?.group.entries.at(-1)).toMatchObject({ id: agent.id, label: agent.name })
    expect(automation?.group.entries.at(-1)).toMatchObject({ id: flow.id, label: flow.name })
    // The shipped entries keep their order in front of the local ones.
    expect(agents?.group.entries.slice(0, 9).some(entry => entry.id === agent.id)).toBe(false)

    centers.removeAgent(agent.id)
    expect(subject.catalog.getSnapshot().groups[0]?.total).toBe(9)

    await fiber.dispose()
    expect(subject.catalog.getSnapshot().claimed).toBe(false)
  })

  it('reports the local half on the queue it serves, in the directory dictionaries', async () => {
    const subject = await bench()
    const centers = createCentersService()
    const fiber = subject.ctx.plugin({
      inject: ['locale', 'slots', 'sidebarCatalog'],
      apply: (ctx: Context) => { registerSuiXingDirectory(ctx, centers, createBridgesService()) },
    })
    await fiber.await()
    const [staffGroup, automationGroup] = DIRECTORY_GROUPS
    expect(localCapabilities(staffGroup!, centers.getSnapshot())).toEqual([])
    centers.addAgent(draftAgentSpec('帮我审一遍合同'))
    expect(localCapabilities(staffGroup!, centers.getSnapshot())).toHaveLength(1)
    expect(localCapabilities(automationGroup!, centers.getSnapshot())).toEqual([])
    expect(directoryEn['page.local.badge']).toBe('Local')
    await fiber.dispose()
  })

  it('names the settings page through the centres namespace', () => {
    expect(CENTERS_NS).toBe('suixing-centers')
    const filled = (key: string): boolean => {
      expect(centersZh[key as keyof typeof centersZh]?.trim()).not.toBe('')
      expect(centersEn[key as keyof typeof centersEn]?.trim()).not.toBe('')
      return true
    }
    for (const key of Object.keys(centersZh)) filled(key)
  })
})
