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
import { bridge, bridgeStatus, bridgeUrl, type BridgeConfig } from '../bridges/spec.ts'
import type { BridgesSnapshot } from '../bridges/store.ts'
import type { CentersSnapshot } from '../centers/store.ts'
import { CapabilityDetail, type DetailConnection, type DetailTarget } from './CapabilityDetail.tsx'
import { localCapabilities } from './capabilities.ts'
import { DIRECTORY_NS, type SuiXingDirectoryKey } from './locales.ts'
import { CREATION_PANEL, type CapabilitySpec, type DirectoryGroupSpec } from './specs.ts'
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
  /** Show one capability in full. */
  readonly focusCapability?: ((id: string) => void) | undefined
  /** Walk back to the list. */
  readonly clearFocus?: (() => void) | undefined
  /** Start work for one capability: a conversation of its own. */
  readonly startCapability?: ((id: string) => void) | undefined
}

/**
 * Whether one capability matches the search text.
 * @param capability - the capability to test.
 * @param needle - lower-cased search text; empty matches everything.
 * @param t - namespace translate seat used for the localized label and lead.
 * @returns whether the capability stays on screen.
 */
function matches(capability: CapabilitySpec, needle: string, t: DirectoryTranslate): boolean {
  if (needle === '') return true
  return t(capability.labelKey).toLowerCase().includes(needle)
    || t(capability.hintKey).toLowerCase().includes(needle)
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
  focusCapability, clearFocus, startCapability, t,
}: DirectoryPageProps) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const snapshot = useCenters(state => state)
  const bridges = useBridges(state => state)
  const focusedId = useFocus(state => state)
  // Only 创作中心 carries sockets; every other menu keeps the status badge.
  const showsConnections = group.panelId === CREATION_PANEL
  const shipped = useMemo(
    () => group.entries.filter(capability => matches(capability, needle, t)),
    [group.entries, needle, t],
  )
  const locals = localCapabilities(group, snapshot)
    .filter(row => needle === '' || row.name.toLowerCase().includes(needle)
      || row.hint.toLowerCase().includes(needle))

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
        <span className={css.count}>{t('page.count', { count: shipped.length + locals.length })}</span>
      </div>
      <ul className={css.list}>
        {shipped.map(capability => (
          <li key={capability.id} className={css.card}>
            <div className={css.cardHead}>
              <h2 className={css.cardName}>{t(capability.labelKey)}</h2>
              <span className={css.badge}>
                {(showsConnections ? bridgeBadge(capability, bridges, t) : null)
                  ?? t('page.status')}
              </span>
              <button
                type="button"
                className={css.cardOpen}
                aria-label={t('page.open', { name: t(capability.labelKey) })}
                onClick={() => { focusCapability?.(capability.id) }}
              >
                {t('page.open.label')}
              </button>
            </div>
            <p className={css.cardLead}>{t(capability.hintKey)}</p>
            <dl className={css.fields}>
              {(capability.card ?? capability.fields).map(field => (
                <div key={field.termKey} className={css.field}>
                  <dt className={css.term}>{t(field.termKey)}</dt>
                  <dd className={css.value}>{t(field.valueKey)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {shipped.length === 0 && locals.length === 0 && <p className={css.empty}>{t('page.empty')}</p>}
      {locals.length > 0 && (
        <section className={css.local}>
          <h2 className={css.localTitle}>{t('page.local')}</h2>
          <p className={css.subtitle}>{t('page.local.hint')}</p>
          <ul className={css.list}>
            {locals.map(row => (
              <li key={row.id} className={css.card}>
                <div className={css.cardHead}>
                  <h3 className={css.cardName}>{row.name}</h3>
                  <span className={css.badge}>{t('page.local.badge')}</span>
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
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
