/**
 * Generic collapsible catalog groups for the sidebar region.
 *
 * Every group renders through this one component: unfold state, the recency
 * cap, search, the "view all" jump, and the loading/empty/offline/error
 * presentations are the shell's; only the group's data is the registrant's.
 * The region renders nothing at all without groups, so a distribution that
 * publishes no catalog keeps the sidebar's previous DOM.
 */
import { useMemo, useState } from 'react'
import { DisclosureRow } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { CATALOG_VISIBLE_LIMIT, type CatalogEntry, type CatalogGroupView, type CatalogSnapshot } from './catalog.ts'
import css from './CatalogGroups.module.css'

/** Props of the catalog region rendered by the sidebar shell. */
export interface CatalogRegionProps {
  /** Live catalog state: status plus the ordered group views. */
  snapshot: CatalogSnapshot
  /** Fold or unfold one group. */
  onToggleGroup: (groupId: string) => void
  /** Record a visit and perform the entry's target. */
  onActivate: (entry: CatalogEntry) => void
  /** Open a group's full directory panel. */
  onSelectPanel: (panelId: MainPanelId) => void
  /** Re-run the registrant's load. */
  onRetry: () => void
  /** Sidebar namespace translate seat. */
  t: TranslateNS<'sidebar'>
}

/**
 * One group's disclosure header plus, when unfolded, its search, rows, and
 * view-all jump. The header rides the shared disclosure chrome, so the whole
 * row and its chevron are the same target and `aria-expanded` is the row's.
 */
function CatalogGroupSection({
  view, onToggleGroup, onActivate, onSelectPanel, t,
}: Pick<CatalogRegionProps, 'onToggleGroup' | 'onActivate' | 'onSelectPanel' | 't'> & {
  view: CatalogGroupView
}) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return undefined
    return view.group.entries.filter(entry => entry.label.toLowerCase().includes(needle)
      || (entry.hint ?? '').toLowerCase().includes(needle))
  }, [query, view.group.entries])
  // A search reflects what it matched; the resting list stays on the shell's
  // recency budget so the region never becomes a wall of rows.
  const rows = (matches ?? view.visible).slice(0, CATALOG_VISIBLE_LIMIT)
  const allPanel = view.group.allPanel
  // The jump belongs to the group's directory rather than to the slice on
  // screen, so a group that names a panel keeps its door open even when its
  // inline rows are empty. While a live search is narrowing the list it
  // follows the rows instead: mid-query the matches are the subject.
  const viewAllPanel = allPanel !== undefined && (matches === undefined || rows.length > 0)
    ? allPanel
    : undefined

  return (
    <DisclosureRow
      icon={<span />}
      title={view.group.title}
      open={view.expanded}
      expandable
      expandOnRowClick
      onToggle={() => { onToggleGroup(view.group.id) }}
      className={css.group}
      rowClassName={css.groupRow}
      titleClassName={css.groupTitle}
    >
      <div className={css.body} role="group" aria-label={view.group.title}>
        {view.group.hint !== undefined && <p className={css.groupHint}>{view.group.hint}</p>}
        <input
          type="search"
          className={css.search}
          aria-label={t('catalog.search')}
          placeholder={t('catalog.search')}
          value={query}
          onChange={(event) => { setQuery(event.target.value) }}
        />
        {rows.map(entry => (
          <button
            key={entry.id}
            type="button"
            className={css.entryRow}
            onClick={() => { onActivate(entry) }}
          >
            <span className={css.entryLabel}>{entry.label}</span>
            {entry.hint !== undefined && <span className={css.entryHint}>{entry.hint}</span>}
          </button>
        ))}
        {matches !== undefined && rows.length === 0 && (
          <p className={css.noticeHint}>{t('catalog.search.empty')}</p>
        )}
        {viewAllPanel !== undefined && (
          <button
            type="button"
            className={css.viewAll}
            onClick={() => { onSelectPanel(viewAllPanel) }}
          >
            {t('catalog.viewAll', { count: view.total })}
          </button>
        )}
      </div>
    </DisclosureRow>
  )
}

/**
 * Render the sidebar's catalog region.
 * @param props - Live catalog state plus the shell's actions and translate seat.
 * @returns The region, or the loading/empty/error presentation when no group can render.
 */
export function CatalogRegion({
  snapshot, onToggleGroup, onActivate, onSelectPanel, onRetry, t,
}: CatalogRegionProps) {
  if (snapshot.groups.length === 0) {
    const failed = snapshot.status === 'error' || snapshot.status === 'offline'
    return (
      <div className={css.notice}>
        <span className={css.noticeTitle}>
          {snapshot.status === 'loading'
            ? t('catalog.loading')
            : failed ? t('catalog.error') : t('catalog.empty')}
        </span>
        {snapshot.status !== 'loading' && <span className={css.noticeHint}>{t('catalog.empty.hint')}</span>}
        {snapshot.canRetry && snapshot.status !== 'loading' && (
          <button type="button" className={css.retry} onClick={onRetry}>{t('catalog.retry')}</button>
        )}
      </div>
    )
  }
  return (
    <div className={css.region}>
      {snapshot.status === 'offline' && (
        <p className={css.banner}>
          <span>{t('catalog.offline')}</span>
          {snapshot.canRetry && (
            <button type="button" className={css.retry} onClick={onRetry}>{t('catalog.retry')}</button>
          )}
        </p>
      )}
      {snapshot.groups.map(view => (
        <CatalogGroupSection
          key={view.group.id}
          view={view}
          onToggleGroup={onToggleGroup}
          onActivate={onActivate}
          onSelectPanel={onSelectPanel}
          t={t}
        />
      ))}
    </div>
  )
}
