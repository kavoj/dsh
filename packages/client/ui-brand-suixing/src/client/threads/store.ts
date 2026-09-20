/**
 * Which conversations a capability started.
 *
 * One record per conversation, held per browser beside the other SuiXing
 * preferences. It is a *binding*, not a copy: the Session lives on the Host
 * and keeps every property it always had — history, search, archive, the
 * workspace browser — while this store remembers only that the capability
 * under 总裁决策官 is where it came from.
 *
 * Because it is the browser's own note, losing it is a lost shortcut and
 * nothing else: the conversations are still in their workspace.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import { liveThreads, type ThreadRecord } from './spec.ts'

/** The binding list as the store holds it. */
export interface ThreadsState {
  /** Every conversation a capability started, in start order. */
  records: readonly ThreadRecord[]
}

/** Read-only view of the binding list. */
export type ThreadsSnapshot = Readonly<ThreadsState>

/** The registrant-facing binding store. */
export interface ThreadsService extends ObservableSnapshot<ThreadsSnapshot> {
  /**
   * The conversations one capability started, newest start last.
   * @param capabilityId - the capability's id, shipped or locally built.
   * @returns its bindings, in start order.
   */
  of(capabilityId: string): readonly ThreadRecord[]
  /**
   * Remember that a capability started a conversation. Binding a Session that
   * was already bound moves it, so a conversation answers to one capability.
   * @param capabilityId - the capability that started it.
   * @param sessionId - the Session it started.
   */
  bind(capabilityId: string, sessionId: string): void
  /**
   * Forget one conversation. The Session itself is untouched.
   * @param sessionId - the Session to drop.
   */
  forget(sessionId: string): void
  /**
   * Drop the bindings whose Session the Host no longer lists.
   * @param live - Session ids the Host still lists.
   */
  keep(live: ReadonlySet<string>): void
}

/** Storage key of the binding list. */
export const THREADS_PERSIST_NAME = 'dsh.suixing.threads'

/**
 * Create the binding store.
 * @returns the service; its state is rehydrated from this browser on creation.
 */
export function createThreadsService(): ThreadsService {
  const store = createSnapshotStore<ThreadsState>(
    { records: [] }, { persist: { name: THREADS_PERSIST_NAME } },
  )
  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: listener => store.subscribe(listener),
    of: capabilityId => store.getSnapshot().records
      .filter(record => record.capabilityId === capabilityId),
    bind: (capabilityId, sessionId) => {
      store.update((draft) => {
        const existing = draft.records.find(record => record.sessionId === sessionId)
        if (existing === undefined) {
          draft.records = [...draft.records, { capabilityId, sessionId, startedAt: Date.now() }]
          return
        }
        if (existing.capabilityId === capabilityId) return
        draft.records = draft.records.map(record => record.sessionId === sessionId
          ? { capabilityId, sessionId, startedAt: record.startedAt }
          : record)
      })
    },
    forget: (sessionId) => {
      store.update((draft) => {
        draft.records = draft.records.filter(record => record.sessionId !== sessionId)
      })
    },
    keep: (live) => {
      store.update((draft) => {
        const kept = liveThreads(draft.records, live)
        if (kept.length === draft.records.length) return
        draft.records = kept
      })
    },
  }
}
