/**
 * Generic collapsible catalog groups for the sidebar region.
 *
 * Every group renders through this one component: unfold state, the recency
 * cap, search, the "view all" jump, and the loading/empty/offline/error
 * presentations are the shell's; only the group's data is the registrant's.
 *
 * A group its registrant marked `manageable` also carries the manage surface —
 * a header menu with rename/delete, and a "new group" seat under the stack —
 * because the business centres a distribution publishes should be re-organised
 * from the sidebar the way the workspace browser already lets a user manage
 * its projects. Those choices are the browser's own preference, held beside
 * the fold state, never an edit of the registrant's configuration.
 *
 * An entry may carry nested rows (see {@link CatalogChild}): the things that
 * entry produced and that the user can walk back into. They render indented
 * under their entry with a status dot, and search matches them, so the region
 * reads as one list. Regions whose entries publish none are byte-identical to
 * the ones built before this existed.
 *
 * The region renders nothing at all without groups, so a distribution that
 * publishes no catalog keeps the sidebar's previous DOM.
 */
import { Fragment, useMemo, useState } from 'react'
import {
  Button, DisclosureRow, IconEditOutline16, IconEllipsisOutline16, IconPlusOutline16,
  IconTrashOutline16, Menu, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import {
  CATALOG_VISIBLE_LIMIT, type CatalogChild, type CatalogEntry, type CatalogGroupView, type CatalogSnapshot,
} from './catalog.ts'
import css from './CatalogGroups.module.css'

/** Props of the catalog region rendered by the sidebar shell. */
export interface CatalogRegionProps {
  /** Live catalog state: status plus the ordered group views. */
  snapshot: CatalogSnapshot
  /** Fold or unfold one group. */
  onToggleGroup: (groupId: string) => void
  /** Record a visit and perform the entry's target. */
  onActivate: (entry: CatalogEntry) => void
  /** Perform one nested row's target (no recency). */
  onActivateChild: (child: CatalogChild) => void
  /** Open a group's full directory panel. */
  onSelectPanel: (panelId: MainPanelId) => void
  /** Re-run the registrant's load. */
  onRetry: () => void
  /** Give a manageable group a browser-local title. */
  onRenameGroup: (groupId: string, title: string) => void
  /** Take a group out of this browser's sidebar. */
  onRemoveGroup: (groupId: string) => void
  /** Add a group the user names. */
  onCreateGroup: (title: string) => void
  /** Sidebar namespace translate seat. */
  t: TranslateNS<'sidebar'>
}

/**
 * The one status a nested row shows. Running outranks the unread reminder: a
 * conversation that is working again is not one waiting for the user.
 * @param child - the nested row.
 * @returns the `data-state` the dot renders with.
 */
function childState(child: CatalogChild): string {
  if (child.running === true) return 'running'
  return child.unread === true ? 'unread' : 'idle'
}

/**
 * One group's disclosure header plus, when unfolded, its search, rows, and
 * view-all jump. The header rides the shared disclosure chrome, so the whole
 * row and its chevron are the same target and `aria-expanded` is the row's.
 * The manage menu rides the header's trailing slot, which the disclosure row
 * keeps inline while open — a group is normally unfolded, and a rename that
 * only appears once you fold it would be a hidden door.
 */
function CatalogGroupSection({
  view, onToggleGroup, onActivate, onActivateChild, onSelectPanel, onRenameRequest, onDeleteRequest, t,
}: Pick<CatalogRegionProps, 'onToggleGroup' | 'onActivate' | 'onActivateChild' | 'onSelectPanel' | 't'> & {
  view: CatalogGroupView
  /** Open the rename dialog for a manageable group. */
  onRenameRequest: (groupId: string, currentTitle: string) => void
  /** Open the delete-confirmation dialog for a manageable group. */
  onDeleteRequest: (groupId: string, title: string) => void
}) {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return undefined
    // A conversation nested under an entry is findable by its own title too:
    // the user reads the sidebar as one list, so search must narrow it as one.
    return view.group.entries.filter(entry => entry.label.toLowerCase().includes(needle)
      || (entry.hint ?? '').toLowerCase().includes(needle)
      || (entry.children ?? []).some(child => child.label.toLowerCase().includes(needle)))
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
  const manageable = view.group.manageable === true
  // A group the user added carries no entries until a platform directory fills
  // it: it still opens, and says so, instead of offering an empty search box.
  // `total` is the declared count, which is what "has capabilities" means here.
  const empty = view.total === 0
  const menuItems = [
    { id: 'rename', label: t('catalog.rename'), icon: <IconEditOutline16 /> },
    { id: 'delete', label: t('catalog.delete'), icon: <IconTrashOutline16 />, danger: true },
  ]

  return (
    <DisclosureRow
      icon={<span />}
      title={view.group.title}
      open={view.expanded}
      expandable
      expandOnRowClick
      onToggle={() => { onToggleGroup(view.group.id) }}
      keepContentWhenOpen={manageable}
      className={css.group}
      rowClassName={css.groupRow}
      titleClassName={css.groupTitle}
      collapsedContent={manageable
        ? (
          <span className={css.rowActions}>
            <Menu
              open={menuOpen}
              onClose={() => { setMenuOpen(false) }}
              items={menuItems}
              onSelect={(id) => {
                setMenuOpen(false)
                // Unknown ids leave before the dispatch: a future menu row must
                // not inherit the destructive branch as an else fallback.
                /* v8 ignore next -- Menu can emit only the rename and delete rows supplied above. */
                if (id !== 'rename' && id !== 'delete') return
                if (id === 'rename') onRenameRequest(view.group.id, view.group.title)
                else onDeleteRequest(view.group.id, view.group.title)
              }}
              portal
              closeOnPointerLeave
              anchor={(
                <button
                  type="button"
                  className={css.rowAction}
                  aria-label={t('catalog.actions', { name: view.group.title })}
                  onClick={(event) => { event.stopPropagation(); setMenuOpen(open => !open) }}
                >
                  <IconEllipsisOutline16 />
                </button>
              )}
            />
          </span>
        )
        : undefined}
    >
      <div className={css.body} role="group" aria-label={view.group.title}>
        {view.group.hint !== undefined && <p className={css.groupHint}>{view.group.hint}</p>}
        {!empty && (
          <input
            type="search"
            className={css.search}
            aria-label={t('catalog.search')}
            placeholder={t('catalog.search')}
            value={query}
            onChange={(event) => { setQuery(event.target.value) }}
          />
        )}
        {rows.map(entry => (
          // A fragment, not a wrapper element: an entry that publishes no
          // children renders its row alone, so the DOM every earlier build
          // produced is unchanged.
          <Fragment key={entry.id}>
            <button
              type="button"
              className={css.entryRow}
              onClick={() => { onActivate(entry) }}
            >
              <span className={css.entryLabel}>{entry.label}</span>
              {entry.hint !== undefined && <span className={css.entryHint}>{entry.hint}</span>}
            </button>
            {entry.children !== undefined && entry.children.length > 0 && (
              <div
                className={css.children}
                role="group"
                aria-label={t('catalog.children', { name: entry.label })}
              >
                {entry.children.map(child => (
                  <button
                    key={child.id}
                    type="button"
                    className={css.childRow}
                    aria-current={child.active === true ? 'page' : undefined}
                    onClick={() => { onActivateChild(child) }}
                  >
                    <span className={css.childDot} data-state={childState(child)} aria-hidden="true" />
                    <span className={css.childLabel}>{child.label}</span>
                    {child.hint !== undefined && <span className={css.childHint}>{child.hint}</span>}
                  </button>
                ))}
              </div>
            )}
          </Fragment>
        ))}
        {matches !== undefined && rows.length === 0 && (
          <p className={css.noticeHint}>{t('catalog.search.empty')}</p>
        )}
        {empty && <p className={css.noticeHint}>{t('catalog.group.empty')}</p>}
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
 * The one name field shared by "new group" and "rename": a single input, the
 * conflict alert, and the standard Cancel / confirm pair. Both flows ask for
 * exactly the same thing, so they ask in exactly the same way.
 */
function NameDialog({
  open, title, fieldLabel, confirmLabel, draft, onDraft, duplicateName, blocked, onClose, onConfirm, t,
}: {
  open: boolean
  title: string
  fieldLabel: string
  confirmLabel: string
  draft: string
  onDraft: (value: string) => void
  /** The title this draft collides with, when it collides at all. */
  duplicateName: string | undefined
  blocked: boolean
  onClose: () => void
  onConfirm: () => void
  t: TranslateNS<'sidebar'>
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t('catalog.close')}
      title={title}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>{t('catalog.cancel')}</Button>
          <Button variant="primary" disabled={blocked} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      <input
        className={css.nameInput}
        value={draft}
        aria-label={fieldLabel}
        autoFocus
        onFocus={(event) => { event.target.select() }}
        onChange={(event) => { onDraft(event.target.value) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onConfirm()
          }
        }}
      />
      {duplicateName !== undefined && (
        <div className={css.dialogError} role="alert">
          {t('catalog.conflict.named', { name: duplicateName })}
        </div>
      )}
    </Modal>
  )
}

/**
 * Render the sidebar's catalog region.
 * @param props - Live catalog state plus the shell's actions and translate seat.
 * @returns The region, or the loading/empty/error presentation when no group can render.
 */
export function CatalogRegion({
  snapshot, onToggleGroup, onActivate, onActivateChild, onSelectPanel, onRetry,
  onRenameGroup, onRemoveGroup, onCreateGroup, t,
}: CatalogRegionProps) {
  // Empty string means "the new-group dialog is open with an empty field".
  const [createDraft, setCreateDraft] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: string; currentTitle: string } | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  // Every group on screen is a candidate conflict, in both directions: a new
  // group may not shadow one, and a rename may not collide with another.
  const titles = snapshot.groups.map(view => view.group.title)
  const createTrimmed = (createDraft ?? '').trim()
  const createDuplicate = createDraft !== null && createTrimmed !== '' && titles.includes(createTrimmed)
  const createBlocked = createTrimmed === '' || createDuplicate
  const renameTrimmed = renameDraft.trim()
  const renameDuplicate = renameTarget !== null && renameTrimmed !== ''
    && renameTrimmed !== renameTarget.currentTitle && titles.includes(renameTrimmed)
  const renameBlocked = renameTarget === null || renameTrimmed === ''
    || renameTrimmed === renameTarget.currentTitle || renameDuplicate

  const confirmCreate = (): void => {
    if (createBlocked) return
    onCreateGroup(createTrimmed)
    setCreateDraft(null)
  }
  const confirmRename = (): void => {
    if (renameBlocked || renameTarget === null) return
    onRenameGroup(renameTarget.id, renameTrimmed)
    setRenameTarget(null)
  }
  const confirmDelete = (): void => {
    if (deleteTarget === null) return
    onRemoveGroup(deleteTarget.id)
    setDeleteTarget(null)
  }

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
          onActivateChild={onActivateChild}
          onSelectPanel={onSelectPanel}
          onRenameRequest={(groupId, currentTitle) => {
            setRenameTarget({ id: groupId, currentTitle })
            setRenameDraft(currentTitle)
          }}
          onDeleteRequest={(groupId, title) => { setDeleteTarget({ id: groupId, title }) }}
          t={t}
        />
      ))}
      {snapshot.canManage && (
        <button type="button" className={css.addGroup} onClick={() => { setCreateDraft('') }}>
          <IconPlusOutline16 />
          <span>{t('catalog.create')}</span>
        </button>
      )}

      <NameDialog
        open={createDraft !== null}
        title={t('catalog.create')}
        fieldLabel={t('catalog.field.groupName')}
        confirmLabel={t('catalog.create')}
        draft={createDraft ?? ''}
        onDraft={(value) => { setCreateDraft(value) }}
        duplicateName={createDuplicate ? createTrimmed : undefined}
        blocked={createBlocked}
        onClose={() => { setCreateDraft(null) }}
        onConfirm={confirmCreate}
        t={t}
      />

      <NameDialog
        open={renameTarget !== null}
        title={t('catalog.rename.title')}
        fieldLabel={t('catalog.field.groupName')}
        confirmLabel={t('catalog.rename')}
        draft={renameDraft}
        onDraft={(value) => { setRenameDraft(value) }}
        duplicateName={renameDuplicate ? renameTrimmed : undefined}
        blocked={renameBlocked}
        onClose={() => { setRenameTarget(null) }}
        onConfirm={confirmRename}
        t={t}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null) }}
        closeLabel={t('catalog.close')}
        title={t('catalog.delete')}
        {...deleteTarget === null
          ? {}
          : { description: t('catalog.delete.desc', { name: deleteTarget.title }) }}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setDeleteTarget(null) }}>{t('catalog.cancel')}</Button>
            <Button variant="outline" className={css.deleteAction} onClick={confirmDelete}>
              {t('catalog.delete')}
            </Button>
          </>
        )}
      />
    </div>
  )
}
