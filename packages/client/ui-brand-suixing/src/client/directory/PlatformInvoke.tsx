/**
 * The platform invoke panel — a ready socket's call loopback on the detail
 * page. 一切接插件 so far only *stated* where a capability runs; this panel
 * makes the platform rung real for the two creation kinds the open API v1
 * publishes as async generation tasks (image, video): describe, submit, watch
 * the task, keep the result on the page.
 *
 * The panel is deliberately the smallest real call: no queue, no history — a
 * task that is submitted keeps running on the platform if the user leaves,
 * which the running copy says out loud. Sockets without a published v1
 * endpoint (ppt, and music beyond the MV shape) say so instead of pretending.
 */
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { createPlatformClient, type PlatformTask } from '../bridges/client.ts'
import { DIRECTORY_NS, type SuiXingDirectoryKey } from './locales.ts'
import css from './CapabilityDetail.module.css'

/** The namespace-bound translate seat this panel reads. */
type InvokeTranslate = PropsLocale<typeof DIRECTORY_NS>['t']

/** The generation kinds this panel can actually drive, with their form facts. */
const FORMS: ReadonlyMap<string, { readonly ratios?: readonly string[]; readonly durations?: readonly number[] }> = new Map([
  ['image', { ratios: ['1:1', '3:4', '4:3', '9:16', '16:9'] }],
  ['video', { durations: [5, 10] }],
])

/** The platform failure codes this distribution carries copy for. */
const KNOWN_CODES: ReadonlySet<string> = new Set([
  'INSUFFICIENT_CREDITS', 'RATE_LIMITED', 'UNAUTHORIZED', 'KEY_REVOKED',
  'FORBIDDEN', 'IP_NOT_ALLOWED', 'UPSTREAM_UNAVAILABLE', 'NETWORK',
  'TASK_FAILED', 'TASK_CANCELED', 'POLL_TIMEOUT', 'MALFORMED_TASK',
])

/** Props the detail page hands the panel. */
export interface PlatformInvokeProps {
  /** The socket's capability id (`image`, `video`, `music`, `ppt`). */
  readonly socketId: string
  /** The resolved absolute endpoint URL. */
  readonly url: string
  /** The configured Bearer key; empty means the panel asks for one. */
  readonly apiKey: string
  /** Namespace translate seat. */
  readonly t: InvokeTranslate
}

/** One observed run's view state, kept minimal and replaced wholesale. */
type InvokeState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'submitting' }
  | { readonly phase: 'running'; readonly status: string }
  | { readonly phase: 'done'; readonly task: PlatformTask }
  | { readonly phase: 'failed'; readonly message: string }

/**
 * Render the platform invoke panel for one socket.
 * @param props - socket facts, credential, translate seat.
 * @returns the panel, or the unsupported note for sockets without a v1 form.
 */
export function PlatformInvoke({ socketId, url, apiKey, t }: PlatformInvokeProps): ReactNode {
  const form = FORMS.get(socketId)
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState(form?.ratios?.[0] ?? '')
  const [duration, setDuration] = useState(form?.durations?.[0] ?? 0)
  const [state, setState] = useState<InvokeState>({ phase: 'idle' })
  const runRef = useRef<AbortController | null>(null)

  if (form === undefined) {
    return <p className={css.invokeNote}>{t('page.invoke.unsupported')}</p>
  }

  const failureCopy = (code: string, message: string, params: Record<string, string | number>): string => {
    if (KNOWN_CODES.has(code)) {
      return t(`page.invoke.err.${code}` as SuiXingDirectoryKey, params)
    }
    return t('page.invoke.err.default', { message })
  }

  const submit = (): void => {
    if (prompt.trim() === '' || state.phase === 'submitting' || state.phase === 'running') return
    const body = socketId === 'image'
      ? { prompt: prompt.trim(), ...(ratio !== '' ? { ratio } : {}) }
      : { prompt: prompt.trim(), ...(duration > 0 ? { duration } : {}) }
    const controller = new AbortController()
    runRef.current = controller
    setState({ phase: 'submitting' })
    const client = createPlatformClient()
    void client.runTask(
      { url, apiKey },
      body,
      {
        signal: controller.signal,
        onStatus: (task) => {
          setState({ phase: 'running', status: task.status === 'pending' ? t('page.invoke.queued') : t('page.invoke.running') })
        },
      },
    ).then((outcome) => {
      runRef.current = null
      if (controller.signal.aborted) return
      if (outcome.ok) {
        setState({ phase: 'done', task: outcome.data })
        return
      }
      const failure = outcome.failure
      const params: Record<string, string | number> = { message: failure.message }
      if (failure.balance !== undefined) params.balance = failure.balance
      if (failure.need !== undefined) params.need = failure.need
      if (failure.retryAfterSeconds !== undefined) params.seconds = failure.retryAfterSeconds
      setState({ phase: 'failed', message: failureCopy(failure.code, failure.message, params) })
    })
  }

  const busy = state.phase === 'submitting' || state.phase === 'running'
  return (
    <div className={css.invoke} data-platform-invoke={socketId}>
      {apiKey === '' && <p className={css.invokeNote}>{t('page.invoke.needKey')}</p>}
      <textarea
        className={css.invokePrompt}
        aria-label={t('page.invoke.prompt')}
        placeholder={t('page.invoke.prompt')}
        value={prompt}
        rows={2}
        onChange={(event) => { setPrompt(event.target.value) }}
      />
      <div className={css.invokeRow}>
        {form.ratios !== undefined && (
          <label className={css.invokeField}>
            <span>{t('page.invoke.ratio')}</span>
            <select value={ratio} onChange={(event) => { setRatio(event.target.value) }}>
              {form.ratios.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        )}
        {form.durations !== undefined && (
          <label className={css.invokeField}>
            <span>{t('page.invoke.duration')}</span>
            <select value={duration} onChange={(event) => { setDuration(Number(event.target.value)) }}>
              {form.durations.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        )}
        <Button variant="primary" disabled={busy || prompt.trim() === ''} onClick={submit}>
          {t('page.invoke.submit')}
        </Button>
      </div>
      {state.phase === 'submitting' && <p className={css.invokeStatus}>{t('page.invoke.submitting')}</p>}
      {state.phase === 'running' && <p className={css.invokeStatus}>{state.status}</p>}
      {state.phase === 'failed' && <p className={css.invokeError}>{state.message}</p>}
      {state.phase === 'done' && <InvokeResult task={state.task} t={t} />}
    </div>
  )
}

/** One finished task's result face: images, or a video player. */
function InvokeResult({ task, t }: { task: PlatformTask; t: InvokeTranslate }): ReactNode {
  const result = (task.result ?? {}) as {
    images?: readonly { url?: unknown }[]
    videos?: readonly { url?: unknown }[]
    url?: unknown
    cost?: unknown
  }
  const imageUrls: string[] = []
  for (const item of result.images ?? []) {
    if (typeof item.url === 'string') imageUrls.push(item.url)
  }
  let videoUrl: string | undefined
  if (typeof result.url === 'string') {
    videoUrl = result.url
  } else {
    for (const item of result.videos ?? []) {
      if (typeof item.url === 'string') {
        videoUrl = item.url
        break
      }
    }
  }
  const cost = typeof result.cost === 'number' ? result.cost : undefined
  return (
    <div className={css.invokeResult} aria-label={t('page.invoke.done')}>
      {imageUrls.length > 0 && (
        <div className={css.invokeImages}>
          {imageUrls.map(url => <img key={url} src={url} alt="" />)}
        </div>
      )}
      {videoUrl !== undefined && <video className={css.invokeVideo} src={videoUrl} controls />}
      {cost !== undefined && <p className={css.invokeCost}>{t('page.invoke.cost', { cost })}</p>}
    </div>
  )
}
