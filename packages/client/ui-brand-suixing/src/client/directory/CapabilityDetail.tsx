/**
 * One capability in full — the page a sidebar entry and a directory card both
 * open, matching the approved prototype's detail view.
 *
 * The directory answers "what exists"; this page answers "what happens if I use
 * it". It carries the definition rows the card already shows, laid out the way
 * the prototype lays them out — quick tasks as chips, a workflow's page steps
 * as a chain, the first question as a quote — plus the two facts a card cannot
 * hold: where the capability will run, and the control that starts it.
 *
 * 创作中心 additionally states its socket here (一切接插件): the address the
 * capability resolves to, and which rung answers it today.
 *
 * The page owns no state. The subject, the resolved connection, and the start
 * action all arrive from the directory, so a capability added later is a data
 * change rather than another page — the same reason the list is generated.
 */
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ReactNode } from 'react'
import type { BridgeSpec, BridgeStatus } from '../bridges/spec.ts'
import type { AgentSpec, WorkflowSpec } from '../centers/spec.ts'
import { PlatformInvoke } from './PlatformInvoke.tsx'
import { DIRECTORY_NS, type SuiXingDirectoryKey } from './locales.ts'
import {
  AGENTS_PANEL, AUTOMATION_PANEL, CREATION_PANEL, PROJECTS_PANEL,
  type CapabilityField, type CapabilitySpec, type DirectoryGroupSpec,
} from './specs.ts'
import css from './CapabilityDetail.module.css'

/** What the detail page is showing: a shipped capability, or one built here. */
export type DetailTarget =
  | { readonly kind: 'shipped'; readonly capability: CapabilitySpec }
  | { readonly kind: 'agent'; readonly agent: AgentSpec }
  | { readonly kind: 'workflow'; readonly workflow: WorkflowSpec }

/** A shipped capability's socket, resolved by the directory that owns the config. */
export interface DetailConnection {
  /** The socket's row in the connection table. */
  readonly spec: BridgeSpec
  /** Which rung answers: this machine, or the platform. */
  readonly status: BridgeStatus
  /** The address the socket resolves to; empty while nothing is configured. */
  readonly url: string
  /** The Bearer credential for the platform call; empty until the user fills it. */
  readonly apiKey: string
}

/** Composed props: the locale seat, the subject, and the two navigations. */
export interface CapabilityDetailProps extends PropsLocale<typeof DIRECTORY_NS> {
  /** The menu this capability belongs to; the breadcrumb names it. */
  readonly group: DirectoryGroupSpec
  /** What to show. */
  readonly target: DetailTarget
  /** The capability's socket; absent for every capability that has none. */
  readonly connection?: DetailConnection | undefined
  /** Walk back to the menu's list. */
  readonly onBack: () => void
  /** Start work in the conversation the capability runs in today. */
  readonly onStart: () => void
  /** Open the edit form for a locally built agent; absent shows no edit door. */
  readonly onEdit?: (() => void) | undefined
}

/** The start control's wording per menu, so each centre keeps its own verb. */
const START_KEYS: Record<string, SuiXingDirectoryKey> = {
  [AGENTS_PANEL]: 'detail.start.agent',
  [AUTOMATION_PANEL]: 'detail.start.workflow',
  [PROJECTS_PANEL]: 'detail.start.project',
  [CREATION_PANEL]: 'detail.start.creation',
}

/**
 * Split a prototype list value into its items. The prototype writes them with
 * the locale's own separator (「；」 in Chinese, 「;」 in English).
 * @param value - the dictionary value.
 * @returns the items, blanks dropped.
 */
function items(value: string): readonly string[] {
  return value.split(/[；;]/).map(part => part.trim()).filter(part => part !== '')
}

/**
 * Split a prototype step value into its steps.
 * @param value - the dictionary value, joined by 「→」.
 * @returns the steps, blanks dropped.
 */
function chain(value: string): readonly string[] {
  return value.split('→').map(part => part.trim()).filter(part => part !== '')
}

/** Where a socket's work happens, in the user's words. */
function rungLabel(status: BridgeStatus, t: CapabilityDetailProps['t']): string {
  if (status === 'ready') return t('page.bridge.platform')
  if (status === 'pending') return t('page.bridge.pending')
  return t('page.bridge.local')
}

/** One titled block: the page's only layout unit. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={css.section}>
      <h2 className={css.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

/**
 * Render one definition row the way its meaning asks to be read: a task list as
 * chips, a page-step list as a chain, the first question as a quote, and every
 * other row as prose.
 * @param props.field - the capability's field descriptor.
 * @param props.t - the namespace translate seat.
 * @returns the block.
 */
function FieldBlock({ field, t }: { field: CapabilityField; t: CapabilityDetailProps['t'] }) {
  const title = t(field.termKey)
  const value = t(field.valueKey)
  if (field.termKey === 'field.tasks') {
    return (
      <Section title={title}>
        <ul className={css.chips}>
          {items(value).map(item => <li key={item} className={css.chip}>{item}</li>)}
        </ul>
      </Section>
    )
  }
  if (field.termKey === 'field.steps') {
    return (
      <Section title={title}>
        <ol className={css.chain}>
          {chain(value).map(step => <li key={step} className={css.chainStep}>{step}</li>)}
        </ol>
      </Section>
    )
  }
  if (field.termKey === 'field.firstQuestion') {
    return <Section title={title}><p className={css.quote}>{value}</p></Section>
  }
  // 总裁决策官's self-introduction: who it is and how to hand work over read
  // as quotations; the problems, refusals, and thinking tools read as lists;
  // the two do-lists read as chips.
  if (field.termKey === 'field.intro' || field.termKey === 'field.howto') {
    return <Section title={title}><p className={css.quote}>{value}</p></Section>
  }
  if (field.termKey === 'field.problems' || field.termKey === 'field.boundary'
    || field.termKey === 'field.mindset') {
    return (
      <Section title={title}>
        <ul className={css.bullets}>
          {items(value).map(item => <li key={item} className={css.bullet}>{item}</li>)}
        </ul>
      </Section>
    )
  }
  if (field.termKey === 'field.cando') {
    return (
      <Section title={title}>
        <ul className={css.chips}>
          {items(value).map(item => <li key={item} className={css.chip}>{item}</li>)}
        </ul>
      </Section>
    )
  }
  return <Section title={title}><p className={css.text}>{value}</p></Section>
}

/**
 * Render one capability in full.
 * @param props - the menu, the subject, its connection, and the two navigations.
 * @returns the detail page.
 */
export function CapabilityDetail({
  group, target, connection, onBack, onStart, onEdit, t,
}: CapabilityDetailProps) {
  const name = target.kind === 'shipped'
    ? t(target.capability.labelKey)
    : target.kind === 'agent' ? target.agent.name : target.workflow.name
  const lead = target.kind === 'shipped'
    ? t(target.capability.hintKey)
    : target.kind === 'agent' ? target.agent.oneLiner : target.workflow.oneLiner
  const startKey = target.kind === 'shipped'
    ? START_KEYS[group.panelId as string] ?? 'detail.start.agent'
    : target.kind === 'agent' ? 'detail.start.agent' : 'detail.start.workflow'
  return (
    <article className={css.page} aria-label={name}>
      <nav className={css.crumbs} aria-label={t('detail.crumb')}>
        <button type="button" className={css.back} onClick={onBack}>
          <span aria-hidden="true">←</span> {t('detail.back')}
        </button>
        <span className={css.crumbWhere}>{t(group.titleKey)}</span>
      </nav>
      <header className={css.head}>
        <h1 className={css.title}>{name}</h1>
        <p className={css.subtitle}>{lead}</p>
      </header>
      {/* Where the work runs: the shipped status line for a capability that only
          exists locally, its own sentence for one this machine built. */}
      <p className={css.status}>
        <span className={css.statusLabel}>
          {target.kind === 'shipped' ? t('page.status') : t('page.local.badge')}
        </span>
        <span className={css.statusHint}>
          {target.kind === 'shipped' ? t('page.status.hint') : t('detail.local.origin')}
        </span>
      </p>

      {target.kind === 'shipped' && target.capability.fields.map(field => (
        <FieldBlock key={field.termKey} field={field} t={t} />
      ))}

      {target.kind === 'agent' && (
        <>
          <Section title={t('detail.local.prompt')}>
            <pre className={css.mono}>{target.agent.rolePrompt}</pre>
          </Section>
          <Section title={t('detail.local.opening')}>
            <p className={css.text}>{target.agent.openingStatement}</p>
          </Section>
          {target.agent.starters.length > 0 && (
            <Section title={t('detail.local.starters')}>
              <ul className={css.chips}>
                {target.agent.starters.map(starter => (
                  <li key={starter} className={css.chip}>{starter}</li>
                ))}
              </ul>
            </Section>
          )}
          {target.agent.assumptions.length > 0 && (
            <Section title={t('detail.local.assumptions')}>
              <ul className={css.bullets}>
                {target.agent.assumptions.map(line => (
                  <li key={line} className={css.bullet}>{line}</li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      {target.kind === 'workflow' && (
        <>
          <Section title={t('detail.local.steps')}>
            <ol className={css.chain}>
              {target.workflow.steps.map(step => (
                <li key={step.stepKey} className={css.chainStep}>{step.name}</li>
              ))}
            </ol>
          </Section>
          {target.workflow.assumptions.length > 0 && (
            <Section title={t('detail.local.assumptions')}>
              <ul className={css.bullets}>
                {target.workflow.assumptions.map(line => (
                  <li key={line} className={css.bullet}>{line}</li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      {/* 一切接插件: the address this capability resolves to, and its rung. */}
      {connection !== undefined && (
        <Section title={t('page.bridge.title')}>
          <p className={css.text}>{rungLabel(connection.status, t)}</p>
          <p className={css.address}>
            <span className={css.method}>{connection.spec.method}</span>
            {' '}
            <span className={css.url}>{connection.url === '' ? connection.spec.path : connection.url}</span>
            {' · '}
            {connection.status === 'local' ? t('page.bridge.reserved') : t('page.bridge.configured')}
          </p>
          {connection.status === 'ready' && (
            <PlatformInvoke socketId={connection.spec.id} url={connection.url} apiKey={connection.apiKey} t={t} />
          )}
        </Section>
      )}

      <div className={css.actions}>
        {onEdit !== undefined && (
          <Button variant="outline" onClick={onEdit}>{t('page.edit')}</Button>
        )}
        <Button variant="primary" onClick={onStart}>{t(startKey)}</Button>
        <span className={css.actionHint}>{t('detail.start.hint')}</span>
      </div>
    </article>
  )
}
