/**
 * The catalog registry: ordering, fold state, the recency budget the sidebar
 * renders against, status reporting with its retry, and dispatch of an
 * activated entry. Pure data — no React and no business name anywhere.
 */
import { describe, expect, it, vi } from 'vitest'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import {
  createSidebarCatalog,
  type CatalogChild, type CatalogEntry, type CatalogGroup,
} from '../src/client/catalog.ts'

const PANEL = 'test-panel' as MainPanelId

/** Build one entry with a command target that records its activation. */
function entry(id: string, hint?: string): CatalogEntry & { runs: number } {
  const command = { runs: 0 }
  return {
    id,
    label: `Entry ${id}`,
    ...(hint === undefined ? {} : { hint }),
    target: { kind: 'command', run: () => { command.runs += 1 } },
    get runs() { return command.runs },
  }
}

/** Build one group over the given entries. */
function group(id: string, entries: readonly CatalogEntry[], extra: Partial<CatalogGroup> = {}): CatalogGroup {
  return { id, title: `Group ${id}`, entries, ...extra }
}

describe('sidebar catalog registry', () => {
  it('starts unclaimed: no distribution publishes, so the shell renders nothing', () => {
    const catalog = createSidebarCatalog(vi.fn())
    expect(catalog.getSnapshot()).toEqual({
      claimed: false, status: 'ready', groups: [], canRetry: false, canManage: false,
    })
    catalog.dispose()
  })

  it('orders groups by their declared order, ties in arrival order', () => {
    const catalog = createSidebarCatalog(vi.fn())
    catalog.register(group('late', [], { order: 2 }))
    catalog.register(group('first-tie', [], { order: 1 }))
    catalog.register(group('second-tie', [], { order: 1 }))
    catalog.register(group('leading', [], { order: 0 }))
    expect(catalog.getSnapshot().groups.map(view => view.group.id))
      .toEqual(['leading', 'first-tie', 'second-tie', 'late'])
    catalog.dispose()
  })

  it('removes exactly the registration a disposer owns', () => {
    const catalog = createSidebarCatalog(vi.fn())
    const keep = group('keep', [])
    const replaceable = group('swap', [])
    const drop = catalog.register(keep)
    const stale = catalog.register(replaceable)
    // Re-registering the id retires the earlier registration's disposer.
    catalog.register(group('swap', []))
    stale()
    expect(catalog.getSnapshot().groups.map(view => view.group.id)).toEqual(['keep', 'swap'])
    drop()
    // The retired disposer is inert, and an unknown id is a no-op.
    drop()
    expect(catalog.getSnapshot().groups.map(view => view.group.id)).toEqual(['swap'])
    catalog.dispose()
  })

  it('releases the claim when the last registrant lets go, and keeps it once a status is reported', () => {
    const catalog = createSidebarCatalog(vi.fn())
    const drop = catalog.register(group('only', []))
    expect(catalog.getSnapshot().claimed).toBe(true)
    // Unloading the distribution that published the catalogue returns the
    // sidebar to its unclaimed DOM rather than to an empty directory.
    drop()
    expect(catalog.getSnapshot()).toMatchObject({ claimed: false, groups: [] })
    // A reported status is its own claim: the region stays for the retry seat.
    catalog.reportStatus('offline', vi.fn())
    expect(catalog.getSnapshot().claimed).toBe(true)
    catalog.dispose()
  })

  it('has nothing to unfold before any group is registered', () => {
    const catalog = createSidebarCatalog(vi.fn())
    catalog.setGroupExpanded('ghost', false)
    catalog.toggleGroup('ghost')
    expect(catalog.getSnapshot().groups).toEqual([])
    catalog.dispose()
  })

  it('unfolds the first group on a first run and materializes that choice on the first toggle', () => {
    const catalog = createSidebarCatalog(vi.fn())
    catalog.register(group('a', []))
    catalog.register(group('b', []))
    expect(catalog.getSnapshot().groups.map(view => view.expanded)).toEqual([true, false])
    catalog.toggleGroup('a')
    expect(catalog.getSnapshot().groups.map(view => view.expanded)).toEqual([false, false])
    catalog.toggleGroup('b')
    expect(catalog.getSnapshot().groups.map(view => view.expanded)).toEqual([false, true])
    catalog.setGroupExpanded('b', true)
    expect(catalog.getSnapshot().groups.map(view => view.expanded)).toEqual([false, true])
    catalog.setGroupExpanded('a', true)
    expect(catalog.getSnapshot().groups.map(view => view.expanded)).toEqual([true, true])
    // Setting the state a group already holds is a no-op, both ways.
    catalog.setGroupExpanded('a', true)
    expect(catalog.getSnapshot().groups.map(view => view.expanded)).toEqual([true, true])
    catalog.setGroupExpanded('a', false)
    expect(catalog.getSnapshot().groups.map(view => view.expanded)).toEqual([false, true])
    catalog.setGroupExpanded('a', false)
    expect(catalog.getSnapshot().groups.map(view => view.expanded)).toEqual([false, true])
    catalog.dispose()
  })

  it('keeps any registration whose id is not the one the disposer owns', () => {
    const catalog = createSidebarCatalog(vi.fn())
    const own = group('own', [])
    const drop = catalog.register(own)
    // A later registration replaces the id and takes over ownership.
    const successor = group('own', [])
    catalog.register(successor)
    drop()
    expect(catalog.getSnapshot().groups.map(view => view.group)).toEqual([successor])
    catalog.dispose()
  })

  it('fills the visible rows from recency, falling back to the declared head', () => {
    const entries = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'].map(id => entry(id))
    const catalog = createSidebarCatalog(vi.fn())
    catalog.register(group('a', entries))
    // First run: the declared head, up to the visible budget.
    expect(catalog.getSnapshot().groups[0]?.visible.map(e => e.id))
      .toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'])
    expect(catalog.getSnapshot().groups[0]?.total).toBe(entries.length)
    // The most recent visit leads, the declared head fills the rest, and the
    // cap holds — recency reorders, it never hides the untouched entries.
    for (const candidate of entries) catalog.activate(candidate)
    expect(catalog.getSnapshot().groups[0]?.visible.map(e => e.id))
      .toEqual(['e7', 'e6', 'e5', 'e4', 'e3', 'e2', 'e1'])
    expect(catalog.getSnapshot().groups[0]?.visible).toHaveLength(entries.length)
    catalog.dispose()
  })

  it('ignores recency recorded against another group and re-visits move to the front', () => {
    const mine = entry('mine')
    const theirs = entry('theirs')
    const catalog = createSidebarCatalog(vi.fn())
    catalog.register(group('a', [mine, entry('other')]))
    catalog.register(group('b', [theirs]))
    // 'theirs' is recent but not ours: our group keeps its declared head.
    catalog.activate(theirs)
    expect(theirs.runs).toBe(1)
    expect(catalog.getSnapshot().groups[0]?.visible.map(e => e.id)).toEqual(['mine', 'other'])
    catalog.activate(entry('other'))
    catalog.activate(mine)
    expect(catalog.getSnapshot().groups[0]?.visible.map(e => e.id)).toEqual(['mine', 'other'])
    catalog.dispose()
  })

  it('caps the remembered recency at its capacity', () => {
    const entries = Array.from({ length: 40 }, (_, index) => entry(`e${index}`))
    const catalog = createSidebarCatalog(vi.fn())
    catalog.register(group('a', entries))
    for (const candidate of entries) catalog.activate(candidate)
    // The newest `CATALOG_VISIBLE_LIMIT` survive; the earliest visits fell
    // out of the visible slice (and evicted from recency past its capacity).
    expect(catalog.getSnapshot().groups[0]?.visible.map(e => e.id))
      .toEqual(['e39', 'e38', 'e37', 'e36', 'e35', 'e34', 'e33', 'e32', 'e31'])
    catalog.dispose()
  })

  it('dispatches a panel target through the injected selector and a command target directly', () => {
    const selectPanel = vi.fn()
    const run = vi.fn()
    const catalog = createSidebarCatalog(selectPanel)
    catalog.register(group('a', [
      { id: 'panel', label: 'Plain panel', target: { kind: 'panel', panelId: PANEL } },
      { id: 'command', label: 'Command', target: { kind: 'command', run } },
    ]))
    catalog.activate({ id: 'panel', label: 'Plain panel', target: { kind: 'panel', panelId: PANEL } })
    expect(selectPanel).toHaveBeenCalledExactlyOnceWith(PANEL)
    expect(run).not.toHaveBeenCalled()
    catalog.activate({ id: 'command', label: 'Command', target: { kind: 'command', run } })
    expect(run).toHaveBeenCalledOnce()
    catalog.dispose()
  })

  it('reports status with and without a retry, and retries only when one is installed', () => {
    const catalog = createSidebarCatalog(vi.fn())
    catalog.reportStatus('loading')
    expect(catalog.getSnapshot()).toMatchObject({ claimed: true, status: 'loading', canRetry: false })
    catalog.retry()
    const retry = vi.fn()
    catalog.reportStatus('offline', retry)
    expect(catalog.getSnapshot().canRetry).toBe(true)
    catalog.retry()
    expect(retry).toHaveBeenCalledOnce()
    catalog.reportStatus('ready')
    expect(catalog.getSnapshot()).toMatchObject({ status: 'ready', canRetry: false })
    catalog.dispose()
  })

  it('notifies subscribers on every change and stops after dispose', () => {
    const catalog = createSidebarCatalog(vi.fn())
    const listener = vi.fn()
    const stop = catalog.subscribe(listener)
    catalog.register(group('a', []))
    catalog.reportStatus('loading')
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    catalog.reportStatus('ready')
    expect(listener).toHaveBeenCalledTimes(2)
    const survivor = vi.fn()
    catalog.subscribe(survivor)
    catalog.dispose()
    catalog.reportStatus('error')
    expect(survivor).not.toHaveBeenCalled()
  })

  it('renames a registrant group locally and hides it on remove', () => {
    const catalog = createSidebarCatalog(vi.fn())
    catalog.register(group('a', [], { manageable: true }))
    catalog.register(group('b', []))
    // A rename is a browser-local override: the registration keeps its data.
    catalog.renameGroup('a', 'My centre')
    expect(catalog.getSnapshot().groups.map(view => view.group.title)).toEqual(['My centre', 'Group b'])
    // A remove takes a registrant's group out of this browser's sidebar.
    catalog.removeGroup('b')
    expect(catalog.getSnapshot().groups.map(view => view.group.id)).toEqual(['a'])
    // Renaming and removing an unknown id is a no-op, not an error.
    catalog.renameGroup('ghost', 'nothing')
    catalog.removeGroup('ghost')
    expect(catalog.getSnapshot().groups.map(view => view.group.id)).toEqual(['a'])
    catalog.dispose()
  })

  it('adds a user group below every registered seat, renames it in place, and drops it', () => {
    const catalog = createSidebarCatalog(vi.fn())
    catalog.register(group('a', [], { order: 10 }))
    const id = catalog.createGroup('我的业务中心')
    expect(id).toBe('user.1')
    const created = catalog.getSnapshot().groups.at(-1)
    expect(created?.group).toMatchObject({ id: 'user.1', title: '我的业务中心', entries: [] })
    expect(created?.group.manageable).toBe(true)
    expect(created?.total).toBe(0)
    // A user group owns its title: renaming rewrites the record, and the id it
    // holds is never handed out twice while it is live.
    catalog.renameGroup('user.1', '数据标注')
    expect(catalog.getSnapshot().groups.at(-1)?.group.title).toBe('数据标注')
    expect(catalog.createGroup('第二组')).toBe('user.2')
    catalog.removeGroup('user.1')
    expect(catalog.getSnapshot().groups.map(view => view.group.id)).toEqual(['a', 'user.2'])
    catalog.dispose()
  })

  it('offers the manage surface only while a manageable group is on screen', () => {
    const catalog = createSidebarCatalog(vi.fn())
    expect(catalog.getSnapshot().canManage).toBe(false)
    catalog.register(group('fixed', []))
    expect(catalog.getSnapshot().canManage).toBe(false)
    const drop = catalog.register(group('manageable', [], { manageable: true }))
    expect(catalog.getSnapshot().canManage).toBe(true)
    drop()
    expect(catalog.getSnapshot().canManage).toBe(false)
    catalog.dispose()
  })

  it('unfolds the first group on screen, not a removed one', () => {
    const catalog = createSidebarCatalog(vi.fn())
    catalog.register(group('a', [], { order: 1, manageable: true }))
    catalog.register(group('b', [], { order: 2 }))
    // First run opens one center; hiding it must open the next, not nothing.
    catalog.removeGroup('a')
    expect(catalog.getSnapshot().groups.map(view => view.group.id)).toEqual(['b'])
    catalog.dispose()
  })
})

describe('sidebar catalog nested rows', () => {
  /** Build one nested row with a command target that records its activation. */
  function child(id: string, extra: Partial<CatalogChild> = {}): CatalogChild & { runs: number } {
    const command = { runs: 0 }
    return {
      id,
      label: `Conversation ${id}`,
      target: { kind: 'command', run: () => { command.runs += 1 } },
      ...extra,
      get runs() { return command.runs },
    }
  }

  it('carries an entry\'s nested rows through to the view unchanged', () => {
    const catalog = createSidebarCatalog(vi.fn())
    const rows = [child('s1', { active: true }), child('s2', { running: true })]
    catalog.register(group('a', [{ ...entry('e1'), children: rows }]))
    const [view] = catalog.getSnapshot().groups
    expect(view?.visible[0]?.children?.map(row => row.id)).toEqual(['s1', 's2'])
    catalog.dispose()
  })

  it('performs a nested row\'s target without recording the entry as visited', () => {
    const catalog = createSidebarCatalog(vi.fn())
    const row = child('s1')
    catalog.register(group('a', [{ ...entry('e1'), children: [row] }]))
    catalog.activateChild(row)
    expect(row.runs).toBe(1)
    // The resting list is built from recency: opening a conversation an entry
    // produced must not promote (or demote) the entry itself.
    expect(catalog.getSnapshot().groups[0]?.visible[0]?.id).toBe('e1')
    catalog.dispose()
  })

  it('selects the panel a nested row names, the same as an entry would', () => {
    const selectPanel = vi.fn()
    const catalog = createSidebarCatalog(selectPanel)
    catalog.activateChild({ id: 's1', label: 'c', target: { kind: 'panel', panelId: PANEL } })
    expect(selectPanel).toHaveBeenCalledWith(PANEL)
    catalog.dispose()
  })
})
