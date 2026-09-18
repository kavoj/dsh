/**
 * The directory template: one page per business menu, rendering the page
 * definitions of every capability the group declares. The group's data arrives
 * through the registration's inject share, so the same component serves both
 * menus and a later menu becomes a registration rather than a page.
 */
import { useMemo, useState } from 'react'
import type { PropsLocale, Translate } from '@deepseek-ai/dsh-client-ui-slots'
import { DIRECTORY_NS, type SuiXingDirectoryKey } from './locales.ts'
import type { CapabilitySpec, DirectoryGroupSpec } from './specs.ts'
import css from './DirectoryPage.module.css'

/** The namespace-bound translate seat this page reads. */
type DirectoryTranslate = Translate<SuiXingDirectoryKey>

/** Composed props the main slot renderer supplies to a directory page. */
export type DirectoryPageProps = PropsLocale<typeof DIRECTORY_NS> & {
  /** The menu this panel is the directory of. */
  readonly group: DirectoryGroupSpec
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
 * Render one business menu's capability directory.
 * @param props - the group descriptor plus the namespace translate seat.
 * @returns the directory page.
 */
export function DirectoryPage({ group, t }: DirectoryPageProps) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = useMemo(
    () => group.entries.filter(capability => matches(capability, needle, t)),
    [group.entries, needle, t],
  )

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
        <span className={css.count}>{t('page.count', { count: shown.length })}</span>
      </div>
      <ul className={css.list}>
        {shown.map(capability => (
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
      {shown.length === 0 && <p className={css.empty}>{t('page.empty')}</p>}
    </article>
  )
}
