// @vitest-environment jsdom
/**
 * The generic catalog region: one component renders every group, and every
 * load state has its own presentation. Fold state, the row budget, search, the
 * view-all jump, and the entry dispatch are the shell's; the group's data is
 * the registrant's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { CatalogRegion, type CatalogRegionProps } from '../src/client/CatalogGroups.tsx'
import { CATALOG_VISIBLE_LIMIT, type CatalogGroupView, type CatalogSnapshot } from '../src/client/catalog.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const PANEL = 'test-all-panel' as MainPanelId

/** English-dictionary translate stub, template params substituted. */
const t: CatalogRegionProps['t'] = (key, params) => {
  const template = (en as Record<string, string>)[key] ?? key
  if (params === undefined) return template
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template,
  )
}

/** The two entries every built group starts from. */
const ENTRIES = [
  { id: 'e1', label: 'Entry one', target: { kind: 'command' as const, run: () => {} } },
  { id: 'e2', label: 'Entry two', target: { kind: 'command' as const, run: () => {} } },
]

/** The group every built view starts from. */
const BASE_GROUP = { id: 'a', title: 'Alpha center', entries: ENTRIES }

/** Build one group view; rows and the total follow the group unless overridden. */
function view({
  group = BASE_GROUP, visible, total, expanded = true,
}: Partial<CatalogGroupView> = {}): CatalogGroupView {
  return {
    group,
    visible: visible ?? group.entries,
    total: total ?? group.entries.length,
    expanded,
  }
}

/** Render the region with the given snapshot and spies. */
function mount(snapshot: Partial<CatalogSnapshot>) {
  const onToggleGroup = vi.fn()
  const onActivate = vi.fn()
  const onSelectPanel = vi.fn()
  const onRetry = vi.fn()
  const full: CatalogSnapshot = {
    claimed: true, status: 'ready', groups: [], canRetry: false, ...snapshot,
  }
  const rendered = render(
    <CatalogRegion
      snapshot={full}
      onToggleGroup={onToggleGroup}
      onActivate={onActivate}
      onSelectPanel={onSelectPanel}
      onRetry={onRetry}
      t={t}
    />,
  )
  return { rendered, onToggleGroup, onActivate, onSelectPanel, onRetry }
}

describe('catalog region states', () => {
  it('reads as loading without offering a retry', () => {
    const b = mount({ status: 'loading' })
    expect(screen.getByText(en['catalog.loading'])).toBeTruthy()
    expect(screen.queryByText(en['catalog.empty.hint'])).toBeNull()
    expect(screen.queryByRole('button', { name: en['catalog.retry'] })).toBeNull()
    b.rendered.unmount()
  })

  it('names the empty state with a way forward', () => {
    const b = mount({})
    expect(screen.getByText(en['catalog.empty'])).toBeTruthy()
    expect(screen.getByText(en['catalog.empty.hint'])).toBeTruthy()
    expect(screen.queryByRole('button', { name: en['catalog.retry'] })).toBeNull()
    b.rendered.unmount()
  })

  it('presents a failed load as a failure, not as an empty directory', () => {
    const b = mount({ status: 'error', canRetry: true })
    expect(screen.getByText(en['catalog.error'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['catalog.retry'] }))
    expect(b.onRetry).toHaveBeenCalledOnce()
    b.rendered.unmount()
  })

  it('treats an offline cache with no groups as a failure without a retry seat', () => {
    const b = mount({ status: 'offline' })
    expect(screen.getByText(en['catalog.error'])).toBeTruthy()
    expect(screen.queryByRole('button', { name: en['catalog.retry'] })).toBeNull()
    b.rendered.unmount()
  })
})

describe('catalog region groups', () => {
  it('keeps cached groups on screen and labels the offline state', () => {
    const b = mount({ status: 'offline', canRetry: true, groups: [view()] })
    expect(screen.getByText(en['catalog.offline'])).toBeTruthy()
    expect(screen.getByText('Alpha center')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['catalog.retry'] }))
    expect(b.onRetry).toHaveBeenCalledOnce()
    b.rendered.unmount()
  })

  it('omits the offline banner while the cache is still good', () => {
    const b = mount({ status: 'ready', canRetry: true, groups: [view()] })
    expect(screen.queryByText(en['catalog.offline'])).toBeNull()
    expect(screen.queryByRole('button', { name: en['catalog.retry'] })).toBeNull()
    b.rendered.unmount()
  })

  it('folds and unfolds from the whole header row, which carries aria-expanded', () => {
    const open = mount({ groups: [view()] })
    const header = screen.getByRole('button', { name: 'Alpha center' })
    expect(header.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Entry one' })).toBeTruthy()
    fireEvent.click(header)
    expect(open.onToggleGroup).toHaveBeenCalledExactlyOnceWith('a')
    open.rendered.unmount()

    const closed = mount({ groups: [view({ expanded: false })] })
    expect(screen.getByRole('button', { name: 'Alpha center' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Entry one' })).toBeNull()
    closed.rendered.unmount()
  })

  it('shows a group hint only when the registrant declared one', () => {
    const withHint = mount({ groups: [view({ group: { id: 'a', title: 'Alpha center', hint: 'Agent center', entries: [] } })] })
    expect(screen.getByText('Agent center')).toBeTruthy()
    withHint.rendered.unmount()

    const bare = mount({ groups: [view()] })
    expect(screen.queryByText('Agent center')).toBeNull()
    bare.rendered.unmount()
  })

  it('activates an entry and renders its own hint when present', () => {
    const b = mount({
      groups: [view({
        group: {
          id: 'a', title: 'Alpha center',
          entries: [{ id: 'e1', label: 'Entry one', hint: 'One line', target: { kind: 'command', run: () => {} } }],
        },
      })],
    })
    expect(screen.getByText('One line')).toBeTruthy()
    fireEvent.click(screen.getByText('Entry one').closest('button')!)
    expect(b.onActivate).toHaveBeenCalledOnce()
    expect(b.onActivate.mock.calls[0]?.[0]).toMatchObject({ id: 'e1' })
    b.rendered.unmount()
  })

  it('renders no hint node for an entry without one', () => {
    const b = mount({ groups: [view()] })
    expect(screen.getByRole('button', { name: 'Entry one' })).toBeTruthy()
    b.rendered.unmount()
  })

  it('offers the view-all jump only for a group that names a directory panel', () => {
    const named = mount({ groups: [view({ total: 9, group: { id: 'a', title: 'Alpha center', entries: [], allPanel: PANEL } })] })
    fireEvent.click(screen.getByRole('button', { name: t('catalog.viewAll', { count: 9 }) }))
    expect(named.onSelectPanel).toHaveBeenCalledExactlyOnceWith(PANEL)
    named.rendered.unmount()

    const unnamed = mount({ groups: [view({ total: 9 })] })
    expect(screen.queryByRole('button', { name: t('catalog.viewAll', { count: 9 }) })).toBeNull()
    unnamed.rendered.unmount()
  })
})

describe('catalog region search', () => {
  it('filters the group to the matches', () => {
    const b = mount({ groups: [view()] })
    fireEvent.change(screen.getByRole('searchbox', { name: en['catalog.search'] }), { target: { value: 'two' } })
    expect(screen.queryByRole('button', { name: 'Entry one' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Entry two' })).toBeTruthy()
    b.rendered.unmount()
  })

  it('says so when nothing matches, and hides the view-all jump with the rows', () => {
    const b = mount({ groups: [view({ total: 9, group: { id: 'a', title: 'Alpha center', entries: [], allPanel: PANEL } })] })
    fireEvent.change(screen.getByRole('searchbox', { name: en['catalog.search'] }), { target: { value: 'nothing' } })
    expect(screen.getByText(en['catalog.search.empty'])).toBeTruthy()
    expect(screen.queryByRole('button', { name: t('catalog.viewAll', { count: 9 }) })).toBeNull()
    b.rendered.unmount()
  })

  it('caps a broad search at the region budget', () => {
    const entries = Array.from({ length: CATALOG_VISIBLE_LIMIT + 3 }, (_, index) => ({
      id: `e${index}`, label: `Match ${index}`, target: { kind: 'command' as const, run: () => {} },
    }))
    const b = mount({ groups: [view({ group: { id: 'a', title: 'Alpha center', entries } })] })
    fireEvent.change(screen.getByRole('searchbox', { name: en['catalog.search'] }), { target: { value: 'match' } })
    expect(screen.getAllByRole('button', { name: /^Match \d$/u })).toHaveLength(CATALOG_VISIBLE_LIMIT)
    b.rendered.unmount()
  })

  it('matches an entry hint as well as its label', () => {
    const b = mount({
      groups: [view({
        group: {
          id: 'a', title: 'Alpha center',
          entries: [
            { id: 'e1', label: 'Entry one', hint: 'Rare phrase', target: { kind: 'command', run: () => {} } },
            { id: 'e2', label: 'Entry two', target: { kind: 'command', run: () => {} } },
          ],
        },
      })],
    })
    fireEvent.change(screen.getByRole('searchbox', { name: en['catalog.search'] }), { target: { value: 'rare' } })
    expect(screen.getByText('Entry one')).toBeTruthy()
    expect(screen.getByText('Rare phrase')).toBeTruthy()
    expect(screen.queryByText('Entry two')).toBeNull()
    b.rendered.unmount()
  })
})
