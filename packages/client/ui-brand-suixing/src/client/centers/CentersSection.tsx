/**
 * The business-centre settings page.
 *
 * Three jobs, in the order a user meets them: choose where capabilities come
 * from, answer the architect's questions, and keep the draft it produces. The
 * drafting step keeps the user in the loop by construction — a draft is shown,
 * never saved silently, and the assumptions the architect had to make are
 * listed above the save action, so "what did it guess?" is answered before
 * anything exists.
 *
 * The questions come first on purpose. Handing a one-liner straight to a
 * template is what made the platform's own form feel mechanical: it filled a
 * prompt from keywords. Asking only the slots the sentence left open (at most
 * three, and skippable) is the difference between a form and a colleague —
 * and every unanswered slot is still recorded as an assumption, so skipping
 * stays honest rather than lossy.
 *
 * The page edits the same service the sidebar directory reads, so a saved
 * agent appears in the AI staff menu without a second step.
 */
import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import { CENTERS_NS } from './locales.ts'
import type { CenterSource, CentersSnapshot } from './store.ts'
import {
  clarifyQuestions, draftAgentSpec, draftWorkflowSpec, outputLabel, OUTPUT_KINDS,
  type AgentDraft, type ClarifyAnswers, type ClarifySlot, type OutputKind, type WorkflowDraft,
} from './spec.ts'
import css from './CentersSection.module.css'

/** Registration-side business face for the business-centre page. */
export interface CentersSectionInjected {
  hooks: {
    /** Page snapshot bound by the renderer as useCenters. */
    centers: ObservableSnapshot<CentersSnapshot>
  }
  /** Choose the capability source. */
  setSource: (source: CenterSource) => void
  /** Record the remote origin. */
  setRemoteBaseUrl: (url: string) => void
  /** Keep a drafted agent. */
  addAgent: (draft: AgentDraft) => void
  /** Forget a locally built agent. */
  removeAgent: (id: string) => void
  /** Keep a drafted workflow. */
  addWorkflow: (draft: WorkflowDraft) => void
  /** Forget a locally built workflow. */
  removeWorkflow: (id: string) => void
}

/**
 * Full component props: the locale seat and the injected business face.
 *
 * The runtime share is deliberately not named. `PropsRuntime<'settings.section'>`
 * carries the framework's global standard kit — panel info, session hooks, the
 * scoped-store seat — none of which this page reads, and naming it would oblige
 * every direct render in a test to stub six hooks the page cannot see. The
 * registration site still checks the composed props against this type, so a
 * member this page actually needs stays a compile error there. DirectoryPage in
 * this same package declares its props the same way, for the same reason.
 */
export type CentersSectionProps =
  PropsLocale<typeof CENTERS_NS>
  & InjectFace<CentersSectionInjected>

/** The draft on screen: which kind, and its current (editable) value. */
type DraftState =
  | { readonly kind: 'agent'; readonly value: AgentDraft }
  | { readonly kind: 'workflow'; readonly value: WorkflowDraft }

/** The interrogation in progress: what is being drafted, and what to ask. */
interface AskingState {
  /** Which kind is being drafted once the questions are answered. */
  readonly kind: DraftState['kind']
  /** Slots the user's sentence left open. */
  readonly slots: readonly ClarifySlot[]
}

/** One draft under review: identity, the editable prompt, and the assumptions. */
function DraftCard({
  draft, onName, onPrompt, onSave, onDiscard, t,
}: {
  draft: DraftState
  /** Rename the draft in place. */
  onName: (name: string) => void
  /** Edit the system prompt in place. */
  onPrompt: (prompt: string) => void
  /** Keep the draft. */
  onSave: () => void
  /** Throw the draft away. */
  onDiscard: () => void
  t: CentersSectionProps['t']
}) {
  const assumptions = draft.value.assumptions
  return (
    <div className={css.draft}>
      <span className={css.badge}>{t('draft.title')}</span>
      <label className={css.field}>
        <span className={css.label}>{t('draft.name')}</span>
        <input
          className={css.input}
          value={draft.value.name}
          onChange={(event) => { onName(event.target.value) }}
        />
      </label>
      <p className={css.oneLiner}>{draft.value.oneLiner}</p>
      {draft.kind === 'agent' ? (
        <>
          <label className={css.field}>
            <span className={css.label}>{t('draft.prompt')}</span>
            <textarea
              className={css.prompt}
              rows={10}
              value={draft.value.rolePrompt}
              onChange={(event) => { onPrompt(event.target.value) }}
            />
          </label>
          <div className={css.block}>
            <span className={css.label}>{t('draft.opening')}</span>
            <p className={css.oneLiner}>{draft.value.openingStatement}</p>
          </div>
          <div className={css.block}>
            <span className={css.label}>{t('draft.starters')}</span>
            <ul className={css.list}>
              {draft.value.starters.map(starter => <li key={starter}>{starter}</li>)}
            </ul>
          </div>
        </>
      ) : (
        <div className={css.block}>
          <span className={css.label}>{t('draft.steps')}</span>
          <ol className={css.list}>
            {draft.value.steps.map(step => (
              <li key={step.stepKey}>
                <strong>{step.name}</strong>
                {' — '}
                {step.prompt}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className={css.assumptions}>
        <span className={css.label}>{t('draft.assumptions')}</span>
        {assumptions.length === 0
          ? <p className={css.oneLiner}>{t('draft.assumptions.none')}</p>
          : (
            <ul className={css.list}>
              {assumptions.map(item => <li key={item}>{item}</li>)}
            </ul>
          )}
      </div>
      <div className={css.actions}>
        <Button variant="primary" onClick={onSave}>
          {draft.kind === 'agent' ? t('draft.save.agent') : t('draft.save.workflow')}
        </Button>
        <Button variant="outline" onClick={onDiscard}>{t('draft.discard')}</Button>
      </div>
    </div>
  )
}

/**
 * Render the business-centre settings page.
 * @param props - the runtime seat, the locale seat, and the injected face.
 * @returns the section content.
 */
export function CentersSection({
  useCenters, setSource, setRemoteBaseUrl, addAgent, removeAgent,
  addWorkflow, removeWorkflow, t,
}: CentersSectionProps) {
  const snapshot = useCenters(state => state)
  const [idea, setIdea] = useState('')
  const [asking, setAsking] = useState<AskingState | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  // The clarify inputs outlive one draft: the same audience usually answers
  // the next idea too, so the user is asked once per sitting, not per draft.
  const [audience, setAudience] = useState('')
  const [forbidden, setForbidden] = useState('')
  const [chosen, setChosen] = useState<readonly OutputKind[]>([])

  /** The answers as they stand; blank slots stay absent so they stay assumed. */
  const collect = (): ClarifyAnswers => ({
    ...(audience.trim() === '' ? {} : { audience: audience.trim() }),
    ...(chosen.length === 0 ? {} : { outputs: chosen }),
    ...(forbidden.trim() === '' ? {} : { forbidden: forbidden.trim() }),
  })

  /** Draft from the current line, asking first for the slots it left open. */
  const start = (kind: DraftState['kind']): void => {
    const trimmed = idea.trim()
    if (trimmed === '') return
    setSaved(null)
    const slots = clarifyQuestions(trimmed, collect())
    if (slots.length === 0) {
      draftFrom(kind, collect())
      return
    }
    setAsking({ kind, slots })
  }

  /** Build the draft, keeping it on screen for review. */
  const draftFrom = (kind: DraftState['kind'], answers: ClarifyAnswers): void => {
    const trimmed = idea.trim()
    setDraft(kind === 'agent'
      ? { kind, value: draftAgentSpec(trimmed, answers) }
      : { kind, value: draftWorkflowSpec(trimmed, answers) })
    setAsking(null)
  }

  /** Apply a field edit to whichever draft is on screen. */
  const editDraft = (patch: { name?: string; rolePrompt?: string }): void => {
    setDraft((current) => {
      if (current === null) return current
      if (current.kind === 'workflow') {
        return patch.name === undefined
          ? current
          : { kind: 'workflow', value: { ...current.value, name: patch.name } }
      }
      return {
        kind: 'agent',
        value: {
          ...current.value,
          ...(patch.name === undefined ? {} : { name: patch.name }),
          ...(patch.rolePrompt === undefined ? {} : { rolePrompt: patch.rolePrompt }),
        },
      }
    })
  }

  /** Toggle one delivery form in the clarify picker. */
  const toggleOutput = (kind: OutputKind): void => {
    setChosen(current => current.includes(kind)
      ? current.filter(item => item !== kind)
      : [...current, kind])
  }

  const keep = (): void => {
    if (draft === null) return
    if (draft.kind === 'agent') addAgent(draft.value)
    else addWorkflow(draft.value)
    setSaved(draft.value.name)
    setDraft(null)
    setAsking(null)
    setIdea('')
  }

  return (
    <div className={css.root}>
      <header className={css.head}>
        <h3 className={css.heading}>{t('section.title')}</h3>
        <p className={css.hint}>{t('section.hint')}</p>
      </header>

      <section className={css.section}>
        <span className={css.label}>{t('source.label')}</span>
        <div className={css.segmented} role="group" aria-label={t('source.label')}>
          {(['local', 'remote'] as const).map(source => (
            <button
              key={source}
              type="button"
              className={css.segment}
              aria-pressed={snapshot.source === source}
              onClick={() => { setSource(source) }}
            >
              {source === 'local' ? t('source.local') : t('source.remote')}
            </button>
          ))}
        </div>
        <p className={css.hint}>
          {snapshot.source === 'local' ? t('source.local.hint') : t('source.remote.hint')}
        </p>
        {snapshot.source === 'remote' && (
          <>
            <label className={css.field}>
              <span className={css.label}>{t('remote.url.label')}</span>
              <input
                className={css.input}
                value={snapshot.remoteBaseUrl}
                placeholder="https://agent.35sz.top"
                onChange={(event) => { setRemoteBaseUrl(event.target.value) }}
              />
            </label>
            <p className={css.notice}>{t('remote.pending')}</p>
          </>
        )}
      </section>

      <section className={css.section}>
        <span className={css.label}>{t('create.title')}</span>
        <p className={css.hint}>{t('create.hint')}</p>
        <label className={css.field}>
          <span className={css.label}>{t('create.field.label')}</span>
          <textarea
            className={css.idea}
            rows={2}
            value={idea}
            placeholder={t('create.placeholder')}
            onChange={(event) => { setIdea(event.target.value) }}
          />
        </label>
        <div className={css.actions}>
          <Button variant="outline" onClick={() => { start('agent') }}>{t('create.agent')}</Button>
          <Button variant="outline" onClick={() => { start('workflow') }}>{t('create.workflow')}</Button>
        </div>

        {asking !== null && (
          <div className={css.asking}>
            <h4 className={css.askingTitle}>{t('clarify.title')}</h4>
            <p className={css.hint}>{t('clarify.hint')}</p>
            {asking.slots.includes('audience') && (
              <label className={css.field}>
                <span className={css.label}>{t('clarify.audience')}</span>
                <input
                  className={css.input}
                  value={audience}
                  placeholder={t('clarify.audience.placeholder')}
                  onChange={(event) => { setAudience(event.target.value) }}
                />
              </label>
            )}
            {asking.slots.includes('outputs') && (
              <div className={css.field}>
                <span className={css.label}>{t('clarify.outputs')}</span>
                <div className={css.chips}>
                  {OUTPUT_KINDS.map(kind => (
                    <button
                      key={kind}
                      type="button"
                      className={css.chip}
                      aria-pressed={chosen.includes(kind)}
                      onClick={() => { toggleOutput(kind) }}
                    >
                      {outputLabel(kind)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {asking.slots.includes('forbidden') && (
              <label className={css.field}>
                <span className={css.label}>{t('clarify.forbidden')}</span>
                <input
                  className={css.input}
                  value={forbidden}
                  placeholder={t('clarify.forbidden.placeholder')}
                  onChange={(event) => { setForbidden(event.target.value) }}
                />
              </label>
            )}
            <div className={css.actions}>
              <Button
                variant="primary"
                onClick={() => { draftFrom(asking.kind, collect()) }}
              >
                {t('clarify.submit')}
              </Button>
              <Button
                variant="outline"
                onClick={() => { draftFrom(asking.kind, collect()) }}
              >
                {t('clarify.skip')}
              </Button>
            </div>
          </div>
        )}

        {draft !== null && (
          <DraftCard
            draft={draft}
            onName={(name) => { editDraft({ name }) }}
            onPrompt={(rolePrompt) => { editDraft({ rolePrompt }) }}
            onSave={keep}
            onDiscard={() => { setDraft(null) }}
            t={t}
          />
        )}
      </section>

      <section className={css.section}>
        <span className={css.label}>{t('list.agents')}</span>
        {snapshot.agents.length === 0
          ? <p className={css.hint}>{t('list.empty')}</p>
          : (
            <ul className={css.rows}>
              {snapshot.agents.map(agent => (
                <li key={agent.id} className={css.row}>
                  <span className={css.rowText}>
                    <span className={css.rowName}>{agent.name}</span>
                    <span className={css.rowHint}>{agent.oneLiner}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { removeAgent(agent.id) }}
                    aria-label={t('list.remove.aria', { name: agent.name })}
                  >
                    {t('list.remove')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className={css.section}>
        <span className={css.label}>{t('list.workflows')}</span>
        {snapshot.workflows.length === 0
          ? <p className={css.hint}>{t('list.empty')}</p>
          : (
            <ul className={css.rows}>
              {snapshot.workflows.map(flow => (
                <li key={flow.id} className={css.row}>
                  <span className={css.rowText}>
                    <span className={css.rowName}>{flow.name}</span>
                    <span className={css.rowHint}>
                      {flow.steps.map(step => step.name).join(' → ')}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { removeWorkflow(flow.id) }}
                    aria-label={t('list.remove.aria', { name: flow.name })}
                  >
                    {t('list.remove')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
      </section>

      {saved !== null && <p className={css.notice}>{`${saved} · ${t('list.live')}`}</p>}
    </div>
  )
}

/** Re-exported for the registration site, which types its inject face with them. */
export type { CenterSource, CentersSnapshot } from './store.ts'
