/**
 * The capability-guidance card on a blank conversation's hero, and the
 * composer footnote under it — the design-file layout: a centered column
 * with kicker, headline, description, one-tap starters, and a "how to
 * start" block; the footnote signs where the conversation is kept.
 *
 * The session's capability is resolved from the thread bindings — the same
 * browser-local note the sidebar's nested rows read — so a conversation that
 * no capability claims renders nothing and the hero stays byte-identical.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AgentSpec } from '../centers/spec.ts'
import type { CentersSnapshot } from '../centers/store.ts'
import {
  DIRECTORY_GROUPS, type CapabilitySpec,
} from '../directory/specs.ts'
import type { ThreadsService } from './store.ts'
import css from '../directory/CapabilityDetail.module.css'

/** Injected share: the binding store the capability resolves from. */
export interface CapabilityHeroInjected {
  readonly threads: ThreadsService
  /** The centres' snapshot hook, for conversations a local agent owns. */
  readonly useCenters?: SnapshotSelectorHook<CentersSnapshot> | undefined
}

/** The centres' configuration when the composition supplies no hook. */
const NO_CENTERS: CentersSnapshot = {
  source: 'local', remoteBaseUrl: '', agents: [], workflows: [],
}

/** Selector hook over nothing: the stable fallback for `useCenters`. */
const noCenters: SnapshotSelectorHook<CentersSnapshot> = select => select(NO_CENTERS)

/** The capability that owns this session, or nothing. */
export function owningCapability(
  threads: ThreadsService, sessionId: string | undefined,
): CapabilitySpec | undefined {
  if (sessionId === undefined) return undefined
  const record = threads.getSnapshot().records.find(item => item.sessionId === sessionId)
  if (record === undefined) return undefined
  for (const group of DIRECTORY_GROUPS) {
    const spec = group.entries.find(entry => entry.id === record.capabilityId)
    if (spec !== undefined) return spec
  }
  return undefined
}

/**
 * The locally built agent that owns this session, or nothing.
 *
 * An agent added in the Agent centre binds conversations by its own store id;
 * the same binding record a shipped capability uses, resolved against the
 * centres' snapshot instead of the shipped spec — which is what makes an edit
 * in the centre change what this conversation page shows.
 * @param threads - the binding store.
 * @param snapshot - the current business-centre configuration.
 * @param sessionId - the session on screen, when there is one.
 * @returns the owning agent, or undefined.
 */
export function owningAgent(
  threads: ThreadsService, snapshot: CentersSnapshot, sessionId: string | undefined,
): AgentSpec | undefined {
  if (sessionId === undefined) return undefined
  const record = threads.getSnapshot().records.find(item => item.sessionId === sessionId)
  if (record === undefined) return undefined
  return snapshot.agents.find(agent => agent.id === record.capabilityId)
}

/** The how-to value of a capability's definition rows, when it has one. */
function howToValue(spec: CapabilitySpec, t: PropsLocale<'suixing-directory'>['t']): string | undefined {
  const row = spec.fields.find(field => field.termKey === 'field.howto')
  return row === undefined ? undefined : t(row.valueKey)
}

/** One tappable starter: the label leads, the action trails at the far end. */
function Starter({
  label, actionLabel, copiedLabel,
}: {
  label: string
  actionLabel: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const take = (): void => {
    void navigator.clipboard.writeText(label).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 1600)
    }).catch(() => { /* clipboard unavailable: the chip stays a plain label */ })
  }
  return (
    <li key={label} className={css.heroStarter}>
      <button type="button" onClick={take} aria-label={`${label} — ${actionLabel}`}>
        <span>{label}</span>
        <span className={css.heroStarterAction} aria-hidden="true">
          {copied ? copiedLabel : actionLabel}
        </span>
      </button>
    </li>
  )
}

/**
 * The hero's capability onboarding card, in the design file's order:
 * kicker → headline → description → starters → how-to block. A conversation a
 * local agent owns renders the same shape from the agent's own configuration —
 * its one-liner as the headline, its opening line as the quote, its starter
 * questions as the tappable chips — so an edit in the centre is an edit here.
 * @param props - session-maybe runtime, bindings, centres hook, translate seat.
 * @returns the card, or nothing when this conversation has no capability.
 */
export function CapabilityHero({
  sessionId, threads, useCenters = noCenters, t,
}: PropsRuntime<'conversation.hero.capability'>
  & PropsLocale<'suixing-directory'>
  & CapabilityHeroInjected): ReactNode {
  const centers = useCenters(state => state)
  const steps = t('hero.steps').split(/[；;]/).map(part => part.trim()).filter(part => part !== '')
  const howBlock = (
    <div className={css.heroHowBlock}>
      <p className={css.heroHowHeading}>{t('hero.how.heading')}</p>
      <p className={css.heroHowHelper}>{t('hero.how.helper')}</p>
      {steps.length > 0 && (
        <p className={css.heroSteps}>
          {steps.map((step, index) => (
            <span key={step}>{String(index + 1).padStart(2, '0')} {step}</span>
          ))}
        </p>
      )}
    </div>
  )
  const spec = owningCapability(threads, sessionId)
  if (spec === undefined) {
    const agent = owningAgent(threads, centers, sessionId)
    if (agent === undefined) return null
    return (
      <section className={css.heroCard} aria-label={agent.name}>
        <p className={css.heroKicker}>{t('hero.kicker')}</p>
        <h2 className={css.heroTitle}>{agent.oneLiner}</h2>
        {agent.openingStatement !== '' && (
          <p className={css.heroHowto}>{agent.openingStatement}</p>
        )}
        {agent.starters.length > 0 && (
          <ul className={css.heroStarters} aria-label={t('hero.starters')}>
            {agent.starters.map(starter => (
              <Starter
                key={starter}
                label={starter}
                actionLabel={t('hero.start')}
                copiedLabel={t('hero.copied')}
              />
            ))}
          </ul>
        )}
        {howBlock}
      </section>
    )
  }
  const howto = howToValue(spec, t)
  const starters = spec.starters ?? []
  return (
    <section className={css.heroCard} aria-label={t(spec.labelKey)}>
      <p className={css.heroKicker}>{t('hero.kicker')}</p>
      <h2 className={css.heroTitle}>{t(spec.hintKey)}</h2>
      {howto !== undefined && <p className={css.heroHowto}>{howto}</p>}
      {starters.length > 0 && (
        <ul className={css.heroStarters} aria-label={t('hero.starters')}>
          {starters.map(key => (
            <Starter
              key={key}
              label={t(key)}
              actionLabel={t('hero.start')}
              copiedLabel={t('hero.copied')}
            />
          ))}
        </ul>
      )}
      {howto === undefined && (
        <div className={css.heroHowBlock}>
          <p className={css.heroHowHeading}>{t('hero.how.heading')}</p>
          {steps.length > 0 && (
            <p className={css.heroSteps}>
              {steps.map((step, index) => (
                <span key={step}>{String(index + 1).padStart(2, '0')} {step}</span>
              ))}
            </p>
          )}
        </div>
      )}
      {howto !== undefined && howBlock}
    </section>
  )
}

/**
 * The composer footnote for a capability conversation: where the chat is kept.
 * A conversation a local agent owns shows it too, so both kinds of capability
 * sign their home. Baseline sessions never see this slot filled.
 * @param props - session-maybe runtime, bindings, centres hook, translate seat.
 * @returns the footnote, or nothing when this conversation has no capability.
 */
export function CapabilityFooter({
  sessionId, threads, useCenters = noCenters, t,
}: PropsRuntime<'conversation.hero.footer'>
  & PropsLocale<'suixing-directory'>
  & CapabilityHeroInjected): ReactNode {
  const centers = useCenters(state => state)
  if (owningCapability(threads, sessionId) === undefined
    && owningAgent(threads, centers, sessionId) === undefined) return null
  return (
    <p className={css.heroFooter}>{t('hero.footer.kept', { home: t('thread.home') })}</p>
  )
}
