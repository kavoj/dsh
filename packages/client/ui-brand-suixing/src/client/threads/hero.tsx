/**
 * The capability-guidance card on a blank conversation's hero: which
 * capability owns this conversation, what to hand it, and one-tap starters.
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
function owningCapability(
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

/** One copyable starter: tap to take the question into the composer. */
function Starter({
  label, copyLabel, copiedLabel,
}: {
  label: string
  copyLabel: string
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
      <button type="button" onClick={take} aria-label={copyLabel}>
        <span>{label}</span>
        <span className={css.heroStarterAction} aria-hidden="true">
          {copied ? copiedLabel : '＋'}
        </span>
      </button>
    </li>
  )
}

/**
 * The hero's capability onboarding card.
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
  const name = t(spec.labelKey)
  const howto = howToValue(spec, t)
  const steps = t('hero.steps').split(/[；;]/).map(part => part.trim()).filter(part => part !== '')
  const starters = spec.starters ?? []
  return (
    <section className={css.heroCard} aria-label={name}>
      <p className={css.heroKicker}>{t('hero.kicker', { name })}</p>
      <h2 className={css.heroTitle}>{t(spec.hintKey)}</h2>
      {howto !== undefined && <p className={css.heroHowto}>{howto}</p>}
      {steps.length > 0 && (
        <p className={css.heroSteps}>
          {steps.map((step, index) => (
            <span key={step}>{String(index + 1).padStart(2, '0')} {step}</span>
          ))}
        </p>
      )}
      {starters.length > 0 && (
        <ul className={css.heroStarters} aria-label={t('hero.starters')}>
          {starters.map(key => (
            <Starter
              key={key}
              label={t(key)}
              copyLabel={t('hero.copy')}
              copiedLabel={t('hero.copied')}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
