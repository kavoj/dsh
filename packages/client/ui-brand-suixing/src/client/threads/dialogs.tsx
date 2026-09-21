/**
 * The conversation-management dialogs for the capability's nested rows:
 * rename and remove, raised from the sidebar's row menus and rendered through
 * the shell's overlay seat.
 *
 * The store is deliberately not persisted — a dialog is transient UI state,
 * and a reload lands on the sidebar with nothing pending. The actions ride
 * the launcher, so a build without the session services simply never opens
 * one: the menu entries only exist where the launcher is available.
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  PropsLocale, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { ThreadLauncher } from './launcher.ts'

/** One pending dialog: the conversation it targets and its current title. */
export interface ThreadDialogTarget {
  readonly sessionId: string
  readonly title: string
}

/** Pending dialog state, held only for this page load. */
export interface ThreadDialogsState {
  readonly rename: ThreadDialogTarget | null
  readonly remove: ThreadDialogTarget | null
}

/** The dialog store the row menus drive and the overlay component reads. */
export interface ThreadDialogs {
  getSnapshot(): ThreadDialogsState
  subscribe(listener: () => void): () => void
  /** Raise the rename dialog with the conversation's current title. */
  openRename(sessionId: string, title: string): void
  /** Raise the remove-confirmation dialog. */
  openRemove(sessionId: string, title: string): void
  /** Close whatever is open. */
  close(): void
}

/** Create the dialog store. */
export function createThreadDialogs(): ThreadDialogs {
  let state: ThreadDialogsState = { rename: null, remove: null }
  const listeners = new Set<() => void>()
  const emit = (): void => {
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    openRename: (sessionId, title) => {
      state = { rename: { sessionId, title }, remove: null }
      emit()
    },
    openRemove: (sessionId, title) => {
      state = { rename: null, remove: { sessionId, title } }
      emit()
    },
    close: () => {
      state = { rename: null, remove: null }
      emit()
    },
  }
}

/** Injected share of the overlay component. */
export interface ThreadDialogsInjected {
  readonly dialogs: ThreadDialogs
  readonly launcher: ThreadLauncher
}

/** Subscribe a component to the dialog store. */
function useDialogsState(dialogs: ThreadDialogs): ThreadDialogsState {
  const [state, setState] = useState(() => dialogs.getSnapshot())
  useEffect(() => dialogs.subscribe(() => { setState(dialogs.getSnapshot()) }), [dialogs])
  return state
}

/**
 * The overlay seat's two dialogs. Rename mirrors the workspace browser's own
 * name field (select-on-focus, Enter confirms); remove confirms in words
 * rather than a bare destructive click.
 * @param props - runtime share, dialogs and launcher, translate seat.
 * @returns the dialogs, or nothing when none is pending.
 */
export function ThreadDialogModals({
  dialogs, launcher, t,
}: PropsRuntime<'shell.overlay'> & PropsLocale<'suixing-directory'> & ThreadDialogsInjected): ReactNode {
  const state = useDialogsState(dialogs)
  const remove = state.remove
  return (
    <>
      {state.rename !== null && (
        <RenameDialog
          key={state.rename.sessionId}
          target={state.rename}
          launcher={launcher}
          close={() => { dialogs.close() }}
          t={t}
        />
      )}
      <Modal
        open={remove !== null}
        onClose={() => { dialogs.close() }}
        closeLabel={t('thread.close')}
        title={t('thread.remove.title')}
        {...remove === null ? {} : { description: t('thread.remove.desc', { name: remove.title }) }}
        footer={(
          <>
            <Button variant="outline" onClick={() => { dialogs.close() }}>
              {t('thread.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (remove === null) return
                dialogs.close()
                void launcher.remove(remove.sessionId)
              }}
            >
              {t('thread.remove.title')}
            </Button>
          </>
        )}
      />
    </>
  )
}

/** One rename dialog: the draft lives only while the dialog does. */
function RenameDialog({
  target, launcher, close, t,
}: {
  target: ThreadDialogTarget
  launcher: ThreadLauncher
  close: () => void
  t: PropsLocale<'suixing-directory'>['t']
}) {
  const [draft, setDraft] = useState(target.title)
  const trimmed = draft.trim()
  const blocked = trimmed === '' || trimmed === target.title
  const confirm = (): void => {
    if (blocked) return
    close()
    void launcher.rename(target.sessionId, trimmed)
  }
  return (
    <Modal
      open
      onClose={close}
      closeLabel={t('thread.close')}
      title={t('thread.rename.title')}
      footer={(
        <>
          <Button variant="outline" onClick={close}>{t('thread.cancel')}</Button>
          <Button variant="primary" disabled={blocked} onClick={confirm}>
            {t('thread.rename.confirm')}
          </Button>
        </>
      )}
    >
      <input
        value={draft}
        aria-label={t('thread.rename.field')}
        autoFocus
        onFocus={(event) => { event.target.select() }}
        onChange={(event) => { setDraft(event.target.value) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            confirm()
          }
        }}
      />
    </Modal>
  )
}
