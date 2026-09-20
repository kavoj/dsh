/**
 * The capability-connection settings page — 一切接插件.
 *
 * One screen states the whole contract: every capability runs on this machine
 * as shipped, and each one may be pointed at an HTTP endpoint instead. The
 * origin is shared, each endpoint is overridable, and nothing here is required
 * for the app to work — which is exactly the point. The platform rung is
 * *reserved*: the addresses are visible and editable, and the local rung keeps
 * answering until the user chooses otherwise.
 *
 * The rows are generated from `BRIDGES`, so a new platform capability is a row
 * in that table rather than a change to this page.
 */
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import { BRIDGES_NS } from './locales.ts'
import {
  BRIDGES, DEFAULT_PLATFORM_BASE, bridgeStatus, bridgeUrl, platformCount,
  type BridgeMode, type BridgeSpec,
} from './spec.ts'
import type { BridgesSnapshot } from './store.ts'
import css from './BridgesSection.module.css'

/** Registration-side business face for the connection page. */
export interface BridgesSectionInjected {
  hooks: {
    /** Page snapshot bound by the renderer as useBridges. */
    bridges: ObservableSnapshot<BridgesSnapshot>
  }
  /** Record the platform origin. */
  setBaseUrl: (url: string) => void
  /** Choose what drives one capability. */
  setMode: (id: string, mode: BridgeMode) => void
  /** Record one capability's endpoint override. */
  setEndpoint: (id: string, endpoint: string) => void
  /** Point every capability at one rung. */
  setAllModes: (mode: BridgeMode) => void
}

/** Composed props: the locale seat and the injected business face. */
export type BridgesSectionProps =
  PropsLocale<typeof BRIDGES_NS>
  & InjectFace<BridgesSectionInjected>

/** One socket row: its name, its rung, and its address. */
function BridgeRow({
  spec, config, setMode, setEndpoint, t,
}: {
  spec: BridgeSpec
  config: BridgesSnapshot
  setMode: (id: string, mode: BridgeMode) => void
  setEndpoint: (id: string, endpoint: string) => void
  t: BridgesSectionProps['t']
}) {
  const name = t(spec.labelKey)
  const mode: BridgeMode = config.modes[spec.id] ?? 'local'
  const status = bridgeStatus(config, spec)
  const url = bridgeUrl(config, spec)
  const override = config.endpoints[spec.id] ?? ''
  return (
    <li className={css.row}>
      <div className={css.rowText}>
        <span className={css.rowName}>{name}</span>
        <span className={css.rowHint}>
          {status === 'local' && t('state.local')}
          {status === 'ready' && t('state.ready', { url })}
          {status === 'pending' && t('state.pending')}
        </span>
      </div>
      <div className={css.controls}>
        <div className={css.segmented} role="group" aria-label={name}>
          {(['local', 'platform'] as const).map(value => (
            <button
              key={value}
              type="button"
              className={css.segment}
              aria-pressed={mode === value}
              onClick={() => { setMode(spec.id, value) }}
            >
              {value === 'local' ? t('row.local') : t('row.platform')}
            </button>
          ))}
        </div>
        <input
          className={css.endpoint}
          value={override}
          aria-label={`${name} ${t('row.endpoint.label')}`}
          placeholder={t('row.endpoint.placeholder', { path: spec.path })}
          onChange={(event) => { setEndpoint(spec.id, event.target.value) }}
        />
        {override.trim() !== '' && (
          <Button
            variant="outline"
            size="sm"
            aria-label={t('row.reset.aria', { name })}
            onClick={() => { setEndpoint(spec.id, '') }}
          >
            {t('row.reset')}
          </Button>
        )}
      </div>
    </li>
  )
}

/**
 * Render the capability-connection settings page.
 * @param props - the locale seat and the injected face.
 * @returns the section content.
 */
export function BridgesSection({
  useBridges, setBaseUrl, setMode, setEndpoint, setAllModes, t,
}: BridgesSectionProps) {
  const config = useBridges(state => state)
  const connected = platformCount(config)
  return (
    <div className={css.root}>
      <header className={css.head}>
        <h3 className={css.heading}>{t('section.title')}</h3>
        <p className={css.hint}>{t('section.hint')}</p>
      </header>

      <section className={css.section}>
        <label className={css.field}>
          <span className={css.label}>{t('base.label')}</span>
          <input
            className={css.input}
            value={config.baseUrl}
            placeholder={DEFAULT_PLATFORM_BASE}
            onChange={(event) => { setBaseUrl(event.target.value) }}
          />
        </label>
        <p className={css.hint}>{t('base.hint')}</p>
        <div className={css.actions}>
          <span className={css.label}>{t('bulk.label')}</span>
          <Button variant="outline" size="sm" onClick={() => { setAllModes('local') }}>
            {t('bulk.local')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setAllModes('platform') }}>
            {t('bulk.platform')}
          </Button>
        </div>
      </section>

      <section className={css.section}>
        <span className={css.label}>{t('list.title')}</span>
        <p className={css.hint}>
          {t('list.summary', { count: connected, total: BRIDGES.length })}
        </p>
        <ul className={css.rows}>
          {BRIDGES.map(spec => (
            <BridgeRow
              key={spec.id}
              spec={spec}
              config={config}
              setMode={setMode}
              setEndpoint={setEndpoint}
              t={t}
            />
          ))}
        </ul>
      </section>

      <p className={css.notice}>{t('note.additive')}</p>
    </div>
  )
}

/** Re-exported for the registration site, which types its inject face with it. */
export type { BridgesSnapshot } from './store.ts'
