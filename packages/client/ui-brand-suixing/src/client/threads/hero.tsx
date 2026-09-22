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
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  DIRECTORY_GROUPS, type CapabilitySpec,
} from '../directory/specs.ts'
import type { ThreadsService } from './store.ts'
import css from '../directory/CapabilityDetail.module.css'

/** Injected share: the binding store the capability resolves from. */
export interface CapabilityHeroInjected {
  readonly threads: ThreadsService
}

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
 * kicker → headline → description → starters → how-to block.
 * @param props - session-maybe runtime, bindings, translate seat.
 * @returns the card, or nothing when this conversation has no capability.
 */
export function CapabilityHero({
  sessionId, threads, t,
}: PropsRuntime<'conversation.hero.capability'>
  & PropsLocale<'suixing-directory'>
  & CapabilityHeroInjected): ReactNode {
  const spec = owningCapability(threads, sessionId)
  if (spec === undefined) return null
  const howto = howToValue(spec, t)
  const steps = t('hero.steps').split(/[；;]/).map(part => part.trim()).filter(part => part !== '')
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
      <div className={css.heroHowBlock}>
        <p className={css.heroHowHeading}>{t('hero.how.heading')}</p>
        {howto !== undefined && <p className={css.heroHowHelper}>{t('hero.how.helper')}</p>}
        {steps.length > 0 && (
          <p className={css.heroSteps}>
            {steps.map((step, index) => (
              <span key={step}>{String(index + 1).padStart(2, '0')} {step}</span>
            ))}
          </p>
        )}
      </div>
    </section>
  )
}

/**
 * The composer footnote for a capability conversation: where the chat is
 * kept. Baseline sessions never see this slot filled.
 * @param props - session-maybe runtime, bindings, translate seat.
 * @returns the footnote, or nothing when this conversation has no capability.
 */
export function CapabilityFooter({
  sessionId, threads, t,
}: PropsRuntime<'conversation.hero.footer'>
  & PropsLocale<'suixing-directory'>
  & CapabilityHeroInjected): ReactNode {
  if (owningCapability(threads, sessionId) === undefined) return null
  return (
    <p className={css.heroFooter}>{t('hero.footer.kept', { home: t('thread.home') })}</p>
  )
}
