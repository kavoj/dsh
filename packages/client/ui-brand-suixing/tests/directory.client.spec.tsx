// @vitest-environment jsdom
/**
 * The SuiXing capability directory: the two business menus of the plan's §2.1
 * decision arrive as data — a catalog group the sidebar shell renders, the main
 * panel its "view all" opens, and the page definitions those panels show. The
 * dictionaries carry the prototype's own copy, so the tests read what the
 * product approved rather than what implementation invented.
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSidebarCatalog } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject } from '../src/client/index.ts'
import { DirectoryPage, type DirectoryPageProps } from '../src/client/directory/DirectoryPage.tsx'
import {
  AGENTS_PANEL, AUTOMATION_PANEL, PROJECTS_PANEL, DIRECTORY_GROUPS, directoryGroup,
  type DirectoryGroupSpec,
} from '../src/client/directory/specs.ts'
import { DIRECTORY_NS, directoryEn, directoryZh } from '../src/client/directory/locales.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
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

/**
 * A cordis bench carrying the three services the plugin injects: the slot
 * registry with the seats ui-layout declares, the locale runtime, and a real
 * sidebar catalog the plugin publishes into.
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
  return { ctx, slots, catalog }
}

describe('SuiXing capability directory — published data', () => {
  it('declares only the services it uses', () => {
    expect(inject).toEqual(['locale', 'slots', 'sidebarCatalog'])
  })

  it('publishes both business menus and the panels behind their "view all"', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'suixing')
    const subject = await bench()
    const fiber = subject.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const snapshot = subject.catalog.getSnapshot()
    expect(snapshot.claimed).toBe(true)
    expect(snapshot.status).toBe('ready')
    expect(snapshot.groups.map(view => view.group.id)).toEqual([
      'suixing.ai-staff', 'suixing.automation', 'suixing.projects',
    ])
    const [agents, automation] = snapshot.groups
    // The runtime's locale decides the wording; both dictionaries carry it.
    expect([directoryZh['group.agents'], directoryEn['group.agents']]).toContain(agents?.group.title)
    expect([directoryZh['group.agents.hint'], directoryEn['group.agents.hint']])
      .toContain(agents?.group.hint)
    expect(agents?.group.allPanel).toBe(AGENTS_PANEL)
    expect(automation?.group.allPanel).toBe(AUTOMATION_PANEL)
    // The menu shows the shell's recency budget while the group holds nine
    // agents and four creation tools.
    expect(agents?.visible).toHaveLength(5)
    expect(agents?.total).toBe(13)
    expect(automation?.total).toBe(4)
    // Every capability opens its group's directory until its own page lands.
    for (const view of snapshot.groups) {
      for (const entry of view.group.entries) {
        expect(entry.target).toEqual({ kind: 'panel', panelId: view.group.allPanel })
      }
    }
    expect(subject.slots.entries('main').map(entry => entry.options.key))
      .toEqual([AGENTS_PANEL, AUTOMATION_PANEL, PROJECTS_PANEL])
    // A first run opens one menu, so the region is never a wall of headers.
    expect(snapshot.groups.map(view => view.expanded)).toEqual([true, false, false])

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
    expect(screen.getAllByText('首期接入中').length).toBe(14)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(13)
    expect(screen.getByText('共 13 项能力')).toBeTruthy()
  })

  it('renders a capability as its lead line plus the prototype definition rows', () => {
    render(<DirectoryPage group={AGENTS} t={zhT} />)
    expect(screen.getByText('总裁决策官')).toBeTruthy()
    expect(screen.getByText('把眼前的难题，理成下一步。')).toBeTruthy()
    expect(screen.getAllByText('用途说明')).toHaveLength(13)
    expect(screen.getByText('找到增长卡点；比较一个重要决策；梳理未来90天重点。')).toBeTruthy()
    expect(screen.getByText('可以先说业务现状和目标；经营报表有就补充，没有也能开始。')).toBeTruthy()
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
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(13)
      expect(catalog.getSnapshot().groups.map(view => view.group.allPanel))
        .toEqual([AGENTS_PANEL, AUTOMATION_PANEL, PROJECTS_PANEL])
    } finally {
      await runtime.dispose()
    }
  })
})
