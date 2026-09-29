/**
 * The sidebar's Flows region, built to read exactly like the workspace region
 * above it: the same fold control, the same search affordance (an icon that
 * expands into an input), the same icon-only view options, and the same add
 * icon — so the two sections behave identically under the pointer.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  IconChevronDownOutlineRegular, IconClockOutlineRegular, IconCloseFillRegular, IconFlatListOutlineRegular,
  IconFolderOpenOutlineRegular, IconPlusOutlineRegular, IconSearchOutlineRegular,
  IconSlidersTwoOutlineRegular, Menu, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { fetchFlows, getView, showView, subscribeView, type Flow } from './flows-api.ts'
import css from './FlowsPage.module.css'

/** Sort orders the view options offer. */
type SortBy = 'updated' | 'name' | 'targets'

/** Join class names, skipping falsey entries. */
const cx = (...values: readonly (string | false | undefined)[]): string => values.filter(Boolean).join(' ')

/** Persist one boolean preference for the sidebar region. */
function useStoredFlag(key: string): [boolean, () => void] {
  const [value, setValue] = useState(() => {
    try { return globalThis.localStorage?.getItem(key) === '1' } catch { return false }
  })
  const toggle = (): void => {
    setValue((current) => {
      const next = !current
      try { globalThis.localStorage?.setItem(key, next ? '1' : '0') } catch { /* private mode */ }
      return next
    })
  }
  return [value, toggle]
}

/**
 * Render the saved-pipeline region of the sidebar.
 * @param props - the sidebar column state.
 * @returns the region, or nothing in the collapsed rail.
 */
export function FlowsSection({ wide }: PropsRuntime<'sidebar.flows'>): ReactNode {
  const [flows, setFlows] = useState<readonly Flow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  const [collapsed, toggleCollapsed] = useStoredFlag('dsh.flows.sectionCollapsed')
  const searchInput = useRef<HTMLInputElement>(null)
  const current = useView()

  useEffect(() => {
    let live = true
    const load = (): void => {
      void fetchFlows().then((status) => {
        if (!live) return
        setFlows(status.flows)
        setError(null)
      }).catch((cause: unknown) => {
        if (!live) return
        setFlows([])
        setError(String((cause as Error).message ?? cause))
      })
    }
    load()
    // The panel writes flows; a light poll keeps both halves showing one truth.
    const timer = setInterval(load, 5000)
    return () => { live = false; clearInterval(timer) }
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = (flows ?? []).filter(flow => needle === ''
      || `${flow.name} ${flow.brief} ${flow.targets.join(' ')}`.toLowerCase().includes(needle))
    const sorted = [...matched]
    if (sortBy === 'name') sorted.sort((left, right) => left.name.localeCompare(right.name, 'zh'))
    else if (sortBy === 'targets') sorted.sort((left, right) => right.targets.length - left.targets.length)
    else sorted.sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1))
    return sorted
  }, [flows, query, sortBy])

  if (!wide) return null

  return (
    <div className={cx(css.section, collapsed && css.sectionCollapsed)}>
      <div className={css.sectionHeader}>
        <button
          type="button"
          title={collapsed ? '展开流程区' : '收起流程区'}
          className={css.iconButton}
          aria-label={collapsed ? '展开流程区' : '收起流程区'}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          <span style={{ display: 'inline-flex', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 120ms' }}><IconChevronDownOutlineRegular /></span>
        </button>
        <span className={cx(css.sectionLabel, searchExpanded && css.sectionLabelHidden)}>流程区</span>
        <div className={cx(css.searchSlot, searchExpanded && css.searchSlotExpanded)}>
          <div className={cx(css.search, searchExpanded && css.searchExpanded)}>
            <button
              type="button"
              title="搜索流程"
              className={css.searchButton}
              aria-label="搜索流程"
              aria-expanded={searchExpanded}
              onClick={() => { setSearchExpanded(true); searchInput.current?.focus() }}
            >
              <IconSearchOutlineRegular size={searchExpanded ? 11 : 14} />
            </button>
            <input
              ref={searchInput}
              className={css.searchInput}
              type="text"
              placeholder="搜索流程"
              value={query}
              tabIndex={searchExpanded ? 0 : -1}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                setQuery('')
                setSearchExpanded(false)
              }}
            />
            {searchExpanded && (
              <button
                type="button"
                className={css.clearButton}
                aria-label="退出搜索"
                title="退出搜索"
                onClick={(event) => {
                  event.stopPropagation()
                  setQuery('')
                  setSearchExpanded(false)
                }}
              >
                <IconCloseFillRegular size={14} />
              </button>
            )}
          </div>
        </div>
        <div className={cx(css.headerActions, searchExpanded && css.headerActionsHidden)}>
          <Menu
            open={viewMenuOpen}
            onClose={() => setViewMenuOpen(false)}
            items={[
              { type: 'label' as const, id: 'sort-by', text: '排序方式' },
              { id: 'updated', label: '最近更新', icon: <IconClockOutlineRegular /> },
              { id: 'name', label: '按名称', icon: <IconFlatListOutlineRegular /> },
              { id: 'targets', label: '按渠道数', icon: <IconFolderOpenOutlineRegular /> },
            ]}
            selectedIds={[sortBy]}
            onSelect={(id) => {
              if (id === 'updated' || id === 'name' || id === 'targets') setSortBy(id)
              setViewMenuOpen(false)
            }}
            align="end"
            dense
            portal
            anchor={(
              <button
                type="button"
                title="视图与排序"
                className={css.iconButton}
                aria-label="视图与排序"
                onClick={() => setViewMenuOpen(value => !value)}
              >
                <IconSlidersTwoOutlineRegular />
              </button>
            )}
          />
          <button
            type="button"
            title="添加流程"
            className={css.iconButton}
            aria-label="添加流程"
            onClick={() => showView({ kind: 'create' })}
          >
            <IconPlusOutlineRegular />
          </button>
        </div>
      </div>

      {collapsed ? null : (
        <>
          {error === null ? null : <p className={css.sectionError}>连接不上流程服务</p>}
          <ul className={css.sectionList}>
            {visible.map(flow => (
              <li key={flow.id}>
                <button
                  type="button"
                  className={current.kind === 'detail' && current.id === flow.id ? css.rowOn : css.row}
                  onClick={() => showView({ kind: 'detail', id: flow.id })}
                >
                  <span className={css.rowName}>{flow.name}</span>
                  <span className={css.rowMeta}>
                    {flow.targets.length === 0 ? '未选渠道' : flow.targets.join(' · ')}
                    <StateDot state="idle" />
                  </span>
                </button>
              </li>
            ))}
            {flows !== null && visible.length === 0 && error === null
              ? <li className={css.sectionEmpty}>{flows.length === 0 ? '还没有流程，点右上角 ＋ 添加' : '没有匹配的流程'}</li>
              : null}
          </ul>
        </>
      )}
    </div>
  )
}

/** Read the shared selection with React's subscription contract. */
function useView(): ReturnType<typeof getView> {
  const [, force] = useState(0)
  useEffect(() => subscribeView(() => force(value => value + 1)), [])
  return getView()
}
