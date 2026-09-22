/**
 * The directory template: one page per business menu, rendering the page
 * definitions of every shipped capability the group declares, plus the
 * capabilities the user built from a sentence in Settings.
 *
 * The shipped half arrives through the registration's inject share, so the same
 * component serves every menu and a later menu becomes a registration rather
 * than a page. The local half arrives through a bound store hook: it is the
 * user's data, it changes while the client runs, and a re-registration per
 * change would be a worse way to say the same thing.
 *
 * The page has two states, both driven by the focus the sidebar and the cards
 * write: the list, and one capability in full. Which one is on screen is
 * navigation state, so it arrives through its own hook rather than through the
 * group descriptor.
 *
 * 创作中心 additionally reads the connection store: each of its four
 * capabilities says whether it runs here or on the platform, which is the one
 * fact a user needs before handing work over.
 */
import { useMemo, useState } from 'react'
import type { PropsLocale, Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { CatalogSnapshot } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { Button, IconPlusOutline16, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { bridge, bridgeStatus, bridgeUrl, type BridgeConfig } from '../bridges/spec.ts'
import type { BridgesSnapshot } from '../bridges/store.ts'
import type { AgentDraft } from '../centers/spec.ts'
import type { CentersSnapshot } from '../centers/store.ts'
import { CapabilityDetail, type DetailConnection, type DetailTarget } from './CapabilityDetail.tsx'
import { localCapabilities } from './capabilities.ts'
import { DIRECTORY_NS, type SuiXingDirectoryKey } from './locales.ts'
import {
  AGENTS_PANEL, CREATION_PANEL, type CapabilitySpec, type DirectoryGroupSpec,
} from './specs.ts'
import css from './DirectoryPage.module.css'

/** The namespace-bound translate seat this page reads. */
type DirectoryTranslate = Translate<SuiXingDirectoryKey>

/** The configuration a page renders when it is composed without the centres
 * service (unit tests, and any composition that ships no settings page). */
const NO_CENTERS: CentersSnapshot = {
  source: 'local', remoteBaseUrl: '', agents: [], workflows: [],
}

/** Selector hook over nothing: the stable fallback for `useCenters`. */
const noCenters: SnapshotSelectorHook<CentersSnapshot> = select => select(NO_CENTERS)

/** The connection configuration a page renders when none was injected. */
const NO_BRIDGES: BridgeConfig = { baseUrl: '', apiKey: '', modes: {}, endpoints: {} }

/** Selector hook over nothing: the stable fallback for `useBridges`. */
const noBridges: SnapshotSelectorHook<BridgesSnapshot> = select => select(NO_BRIDGES)

/** Selector hook over nothing: the stable fallback for `useFocus`. */
const noFocus: SnapshotSelectorHook<string | null> = select => select(null)

/** Selector hook over nothing: the stable fallback for `useCatalog`. */
const noCatalog: SnapshotSelectorHook<CatalogSnapshot | null> = select => select(null)

/**
 * The role prompt a quick-added agent runs on when the user left the field
 * empty: enough of a spine to hold the conversation together, small enough to
 * replace wholesale once the user writes the real one in Settings.
 * @param name - the agent's name.
 * @param oneLiner - its one-line promise, when the user gave one.
 * @returns the default role prompt.
 */
function defaultRolePrompt(name: string, oneLiner: string): string {
  return [
    `你是「${name}」。${oneLiner === '' ? '协助用户把一件事推进到下一步。' : oneLiner + '。'}`,
    '先确认目标与约束，再给方案；信息不足时先问，不要臆测。',
    '结论先行，关键判断给出依据；不确定的地方明确标注。',
  ].join('\n')
}

/** Composed props the main slot renderer supplies to a directory page. */
export type DirectoryPageProps = PropsLocale<typeof DIRECTORY_NS> & {
  /** The menu this panel is the directory of. */
  readonly group: DirectoryGroupSpec
  /** Business-centre snapshot hook; absent renders the shipped capabilities only. */
  readonly useCenters?: SnapshotSelectorHook<CentersSnapshot> | undefined
  /** Connection snapshot hook; absent renders every capability as local. */
  readonly useBridges?: SnapshotSelectorHook<BridgesSnapshot> | undefined
  /** Focused-capability hook; absent renders the list only. */
  readonly useFocus?: SnapshotSelectorHook<string | null> | undefined
  /** Catalog snapshot hook; absent renders the declared order only. */
  readonly useCatalog?: SnapshotSelectorHook<CatalogSnapshot | null> | undefined
  /** Show one capability in full. */
  readonly focusCapability?: ((id: string) => void) | undefined
  /** Walk back to the list. */
  readonly clearFocus?: (() => void) | undefined
  /** Start work for one capability: a conversation of its own. */
  readonly startCapability?: ((id: string) => void) | undefined
  /** Store one agent added from this page's own form; absent hides the form. */
  readonly addAgent?: ((draft: AgentDraft) => void) | undefined
  /** Persist the entry sequence the user dragged; absent disables dragging. */
  readonly reorderEntries?: ((entryIds: readonly string[]) => void) | undefined
}

/**
 * The connection badge of one capability: where it runs, in the user's words.
 * @param capability - the capability being rendered.
 * @param config - the connection configuration.
 * @param t - namespace translate seat.
 * @returns the badge text, or null when the capability has no socket.
 */
function bridgeBadge(
  capability: CapabilitySpec, config: BridgeConfig, t: DirectoryTranslate,
): string | null {
  const spec = bridge(capability.id)
  if (spec === undefined) return null
  const status = bridgeStatus(config, spec)
  if (status === 'ready') return t('page.bridge.platform')
  if (status === 'pending') return t('page.bridge.pending')
  return t('page.bridge.local')
}

/**
 * Render one business menu: its capability list, or the one capability the user
 * opened from the sidebar or from a card.
 * @param props - the group descriptor, the injected hooks and actions, and the
 * translate seat.
 * @returns the directory page.
 */
export function DirectoryPage({
  group, useCenters = noCenters, useBridges = noBridges, useFocus = noFocus,
  useCatalog = noCatalog, focusCapability, clearFocus, startCapability,
  addAgent, reorderEntries, t,
}: DirectoryPageProps) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const snapshot = useCenters(state => state)
  const bridges = useBridges(state => state)
  const focusedId = useFocus(state => state)
  const savedOrder = useCatalog(state => state)
    ?.groups.find(view => view.group.id === group.id)?.ordered
  // Only 创作中心 carries sockets; every other menu keeps the status badge.
  const showsConnections = group.panelId === CREATION_PANEL

  /**
   * One row of the page's list: a shipped capability or a locally built one.
   * They share the list so a dragged arrangement can interleave them — the
   * sidebar's first nine come from this same order.
   */
  interface Row {
    readonly id: string
    readonly name: string
    readonly hint: string
    readonly local: boolean
    /** The shipped descriptor, when this row is one; locals render leaner. */
    readonly capability?: CapabilitySpec
  }
  const rows = useMemo((): readonly Row[] => {
    const shipped = group.entries.map<Row>(capability => ({
      id: capability.id,
      name: t(capability.labelKey),
      hint: t(capability.hintKey),
      local: false,
      capability,
    }))
    const locals = localCapabilities(group, snapshot).map<Row>(local => ({
      id: local.id, name: local.name, hint: local.hint, local: true,
    }))
    const all = [...shipped, ...locals]
    if (needle !== '') {
      return all.filter(row => row.name.toLowerCase().includes(needle)
        || row.hint.toLowerCase().includes(needle))
    }
    // The arrangement the user dragged leads; the declared head fills the
    // rest, so a centre that grew since the drag stays on the list.
    if (savedOrder === undefined) return all
    const rest = new Map(all.map(row => [row.id, row]))
    const head = [...new Set(savedOrder)].flatMap((id) => {
      const row = rest.get(id)
      rest.delete(id)
      return row === undefined ? [] : [row]
    })
    return [...head, ...rest.values()]
  }, [group, snapshot, needle, savedOrder, t])

  // Drag-and-drop reordering: the arrangement commits on drop through the
  // injected callback, which is the same record the sidebar reads — one fact,
  // two surfaces. Searching suspends dragging: you reorder the list you see.
  const [dragId, setDragId] = useState<string | null>(null)
  const draggable = needle === '' && reorderEntries !== undefined
  const dropOn = (targetId: string): void => {
    if (!draggable || dragId === null || dragId === targetId) return
    const ids = rows.map(row => row.id)
    ids.splice(ids.indexOf(targetId), 0, ...ids.splice(ids.indexOf(dragId), 1))
    reorderEntries(ids)
    setDragId(null)
  }

  // The page's own add form: name required, the rest optional, one agent per
  // confirm. It stores through the same service Settings uses, so the new
  // agent is in the sidebar and this list the moment the modal closes.
  const canAdd = group.panelId === AGENTS_PANEL && addAgent !== undefined
  const [addOpen, setAddOpen] = useState(false)
  const [addDraft, setAddDraft] = useState({ name: '', oneLiner: '', persona: '' })
  const addBlocked = addDraft.name.trim() === ''
  const confirmAdd = (): void => {
    if (!canAdd || addBlocked) return
    const name = addDraft.name.trim()
    const oneLiner = addDraft.oneLiner.trim()
    const persona = addDraft.persona.trim()
    addAgent({
      name,
      oneLiner: oneLiner === '' ? `按「${name}」的角色协助处理日常事务` : oneLiner,
      role: 'specialist',
      rolePrompt: persona === '' ? defaultRolePrompt(name, oneLiner) : persona,
      guardrails: [],
      tools: [],
      datasets: [],
      openingStatement: `我是${name}。说说你手上这件事，我来出方案。`,
      starters: [],
      inputs: [],
      outputContract: '文档',
      assumptions: ['由「添加智能体」快速创建；角色设定与交付形态可随后在设置中完善'],
    })
    setAddOpen(false)
    setAddDraft({ name: '', oneLiner: '', persona: '' })
  }

  // The focused capability, resolved against both halves of the list: a shipped
  // id opens its definition, a local id opens the record the architect built.
  const detail = useMemo((): DetailTarget | null => {
    if (focusedId === null) return null
    const capability = group.entries.find(entry => entry.id === focusedId)
    if (capability !== undefined) return { kind: 'shipped', capability }
    const agent = snapshot.agents.find(item => item.id === focusedId)
    if (agent !== undefined) return { kind: 'agent', agent }
    const workflow = snapshot.workflows.find(item => item.id === focusedId)
    if (workflow !== undefined) return { kind: 'workflow', workflow }
    return null
  }, [focusedId, group, snapshot])

  const connection = useMemo((): DetailConnection | undefined => {
    if (detail === null || detail.kind !== 'shipped' || !showsConnections) return undefined
    const spec = bridge(detail.capability.id)
    if (spec === undefined) return undefined
    return { spec, status: bridgeStatus(bridges, spec), url: bridgeUrl(bridges, spec), apiKey: bridges.apiKey }
  }, [detail, showsConnections, bridges])

  if (detail !== null) {
    return (
      <CapabilityDetail
        group={group}
        target={detail}
        connection={connection}
        onBack={() => { clearFocus?.() }}
        onStart={() => { if (focusedId !== null) startCapability?.(focusedId) }}
        t={t}
      />
    )
  }

  return (
    <article className={css.page} aria-label={t(group.titleKey)}>
      <header className={css.head}>
        <h1 className={css.title}>{t(group.titleKey)}</h1>
        <p className={css.subtitle}>{t(group.hintKey)}</p>
      </header>
      <p className={css.status}>
        <span className={css.statusLabel}>{t('page.status')}</span>
        <span className={css.statusHint}>{t('page.status.hint')}</span>
      </p>
      <div className={css.toolbar}>
        <input
          type="search"
          className={css.search}
          aria-label={t('page.search')}
          placeholder={t('page.search')}
          value={query}
          onChange={(event) => { setQuery(event.target.value) }}
        />
        <span className={css.count}>{t('page.count', { count: rows.length })}</span>
        {canAdd && (
          <button
            type="button"
            className={css.addBtn}
            onClick={() => { setAddDraft({ name: '', oneLiner: '', persona: '' }); setAddOpen(true) }}
          >
            <IconPlusOutline16 />
            {t('page.add')}
          </button>
        )}
      </div>
      {reorderEntries !== undefined && draggable && rows.length > 1 && (
        <p className={css.orderHint}>{t('page.order.hint')}</p>
      )}
      <ul className={css.list}>
        {rows.map((row) => {
          const badge = row.local
            ? t('page.local.badge')
            : (showsConnections && row.capability !== undefined
              ? bridgeBadge(row.capability, bridges, t) ?? t('page.status')
              : t('page.status'))
          return (
            <li
              key={row.id}
              className={`${css.card} ${dragId === row.id ? css.cardDragging : ''}`}
              draggable={draggable}
              onDragStart={() => { setDragId(row.id) }}
              onDragOver={(event) => { if (dragId !== null) event.preventDefault() }}
              onDrop={() => { dropOn(row.id) }}
              onDragEnd={() => { setDragId(null) }}
            >
              <div className={css.cardHead}>
                <h2 className={css.cardName}>{row.name}</h2>
                <span className={css.badge}>{badge}</span>
                <button
                  type="button"
                  className={css.cardOpen}
                  aria-label={t('page.open', { name: row.name })}
                  onClick={() => { focusCapability?.(row.id) }}
                >
                  {t('page.open.label')}
                </button>
              </div>
              <p className={css.cardLead}>{row.hint}</p>
              {row.capability !== undefined && (
                <dl className={css.fields}>
                  {(row.capability.card ?? row.capability.fields).map(field => (
                    <div key={field.termKey} className={css.field}>
                      <dt className={css.term}>{t(field.termKey)}</dt>
                      <dd className={css.value}>{t(field.valueKey)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          )
        })}
      </ul>
      {rows.length === 0 && <p className={css.empty}>{t('page.empty')}</p>}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false) }}
        closeLabel={t('page.add.cancel')}
        title={t('page.add.title')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setAddOpen(false) }}>{t('page.add.cancel')}</Button>
            <Button variant="primary" disabled={addBlocked} onClick={confirmAdd}>{t('page.add.confirm')}</Button>
          </>
        )}
      >
        <div className={css.addForm}>
          <label className={css.addField}>
            <span className={css.addFieldLabel}>{t('page.add.name')}</span>
            <input
              className={css.addFieldInput}
              value={addDraft.name}
              autoFocus
              onChange={(event) => { setAddDraft(state => ({ ...state, name: event.target.value })) }}
            />
          </label>
          <label className={css.addField}>
            <span className={css.addFieldLabel}>{t('page.add.oneLiner')}</span>
            <input
              className={css.addFieldInput}
              value={addDraft.oneLiner}
              placeholder={t('page.add.oneLiner.hint')}
              onChange={(event) => { setAddDraft(state => ({ ...state, oneLiner: event.target.value })) }}
            />
          </label>
          <label className={css.addField}>
            <span className={css.addFieldLabel}>{t('page.add.persona')}</span>
            <textarea
              className={css.addFieldArea}
              rows={5}
              value={addDraft.persona}
              placeholder={t('page.add.persona.hint')}
              onChange={(event) => { setAddDraft(state => ({ ...state, persona: event.target.value })) }}
            />
          </label>
        </div>
      </Modal>
    </article>
  )
}
