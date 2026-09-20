/**
 * Which capability the directory is showing in full.
 *
 * This is navigation state, not user data. It is deliberately *not* persisted:
 * a reload lands back on the menu the user was reading rather than reopening a
 * page they never chose in this session. The sidebar writes it when an entry is
 * activated; the directory page clears it when the user walks back to the list.
 *
 * One store, two writers, no layout change: the sidebar entry and the card in
 * the list are the same navigation, so the prototype's "open the entry, land on
 * the capability" needs a fact both can share rather than a second code path.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'

/** The focused-capability service: one capability at a time, or none. */
export interface DirectoryFocus extends ObservableSnapshot<string | null> {
  /**
   * Show one capability in full.
   * @param id - the capability's id, shipped or locally built.
   */
  focus(id: string): void
  /** Walk back to the menu's list. */
  clear(): void
}

/**
 * Create the focused-capability service.
 * @returns the service; its state lives only for this page load.
 */
export function createDirectoryFocus(): DirectoryFocus {
  const store = createSnapshotStore<string | null>(null)
  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: listener => store.subscribe(listener),
    focus: (id) => { store.set(id) },
    clear: () => { store.set(null) },
  }
}
