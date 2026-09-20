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
 */
import { useMemo, useState } from 'react'
import type { PropsLocale, Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { CentersSnapshot } from '../centers/store.ts'
import { DIRECTORY_NS, type SuiXingDirectoryKey } from './locales.ts'
import { AGENTS_PANEL, AUTOMATION_PANEL, type CapabilitySpec, type DirectoryGroupSpec } from './specs.ts'
import css from './DirectoryPage.module.css'

/** The namespace-bound translate seat this page reads. */
type DirectoryTranslate = Translate<SuiXingDirectoryKey>

/** One locally built capability, as the page lists it. */
interface LocalRow {
  /** Store id. */
  readonly id: string
  /** Name the user kept. */
  readonly name: string
  /** One-line promise, or a workflow's step chain. */
  readonly hint: string
}

/** The configuration a page renders when it is composed without the centres
 * service (unit tests, and any composition that ships no settings page). */
const NO_CENTERS: CentersSnapshot = {
  source: 'local', remoteBaseUrl: '', agents: [], workflows: [],
}

/** Selector hook over nothing: the stable fallback for `useCenters`. */
const noCenters: SnapshotSelectorHook<CentersSnapshot> = select => select(NO_CENTERS)

/** Composed props the main slot renderer supplies to a directory page. */
export type DirectoryPageProps = PropsLocale<typeof DIRECTORY_NS> & {
  /** The menu this panel is the directory of. */
  readonly group: DirectoryGroupSpec
  /** Business-centre snapshot hook; absent renders the shipped capabilities only. */
  readonly useCenters?: SnapshotSelectorHook<CentersSnapshot> | undefined
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
 * The locally built capabilities of one menu, in the shape the page renders.
 * @param group - the menu being rendered.
 * @param snapshot - the business-centre configuration.
 * @returns the local rows, empty for a menu the local architect does not fill.
 */
function localRows(group: DirectoryGroupSpec, snapshot: CentersSnapshot): readonly LocalRow[] {
  if (group.panelId === AGENTS_PANEL) {
    return snapshot.agents.map(agent => ({ id: agent.id, name: agent.name, hint: agent.oneLiner }))
  }
  if (group.panelId === AUTOMATION_PANEL) {
    return snapshot.workflows.map(flow => ({
      id: flow.id,
      name: flow.name,
      hint: flow.steps.map(step => step.name).join(' → '),
    }))
  }
  return []
}

/**
 * Render one business menu's capability directory.
 * @param props - the group descriptor, the centres hook, and the translate seat.
 * @returns the directory page.
 */
export function DirectoryPage({ group, useCenters = noCenters, t }: DirectoryPageProps) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const snapshot = useCenters(state => state)
  const shipped = useMemo(
    () => group.entries.filter(capability => matches(capability, needle, t)),
    [group.entries, needle, t],
  )
  const locals = localRows(group, snapshot)
    .filter(row => needle === '' || row.name.toLowerCase().includes(needle)
      || row.hint.toLowerCase().includes(needle))

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
              <span className={css.badge}>{t('page.status')}</span>
            </div>
            <p className={css.cardLead}>{t(capability.hintKey)}</p>
            <dl className={css.fields}>
              {capability.fields.map(field => (
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
