/**
 * A capability's conversations, as rows.
 *
 * Starting one is not a special kind of work here: it is an ordinary Session
 * the Host creates, the Session Controller lists, and the conversation panel
 * renders — the same entity the workspace browser already shows, keeps in
 * history, and can search. What this module adds is the *other* way to reach
 * it: nested under the capability that started it, in the business menu the
 * user was standing in.
 *
 * Pure on purpose. Which title a Session carries, whether it is working, and
 * whether it is the one on screen are facts about the Session list, so the
 * projection takes that list structurally and the caller keeps the wiring.
 */
/**
 * Conversations one capability shows at once, newest first, matching the
 * budget the shell already gives a group's own rows. A conversation past the
 * cap is not lost — it is still a Session, so the workspace browser still
 * lists it.
 */
export const THREAD_VISIBLE_LIMIT = 5

/**
 * One conversation, remembered against the capability that started it.
 *
 * The binding is this browser's own: the Session itself is the Host's, and
 * nothing about it is edited to record where it came from.
 */
export interface ThreadRecord {
  /** The capability that started this conversation. */
  readonly capabilityId: string
  /** The Session the capability started. */
  readonly sessionId: string
  /** When it was started, for ordering two conversations of the same age. */
  readonly startedAt: number
}

/** The Session facts one nested row needs, structurally. */
export interface ThreadSummary {
  /** The title the Host stored; empty until the conversation is named. */
  readonly displayTitle: string
  /** A Session born but not yet spoken in. */
  readonly blank: boolean
  readonly updatedAt: number
  readonly running: boolean
}

/** One conversation, ready for the sidebar to render. */
export interface ThreadRow {
  /** The Session identity; also the row's stable key and what it opens. */
  readonly sessionId: string
  /** The stored title, or empty for a conversation nobody has named yet. */
  readonly title: string
  readonly running: boolean
  /** This conversation is the one on screen. */
  readonly active: boolean
}

/**
 * Project one capability's conversations onto rows: newest first, only the
 * ones the Host still lists, capped.
 * @param records - the conversations bound to this capability.
 * @param summaries - the current Session list, keyed by Session id.
 * @param current - the Session showing in the main view, when there is one.
 * @returns the rows, in render order.
 */
export function threadRows(
  records: readonly ThreadRecord[],
  summaries: Readonly<Record<string, ThreadSummary | undefined>>,
  current: string | undefined,
): readonly ThreadRow[] {
  return records
    .flatMap((record) => {
      const summary = summaries[record.sessionId]
      // A Session the Host no longer lists was archived or deleted: the row
      // goes with it rather than becoming a door to nothing.
      return summary === undefined ? [] : [{ record, summary }]
    })
    .sort((left, right) => right.summary.updatedAt - left.summary.updatedAt
      || right.record.startedAt - left.record.startedAt)
    .slice(0, THREAD_VISIBLE_LIMIT)
    .map(({ record, summary }) => ({
      sessionId: record.sessionId,
      title: summary.blank ? '' : summary.displayTitle,
      running: summary.running,
      active: record.sessionId === current,
    }))
}

/**
 * Drop the bindings whose Session the Host no longer lists.
 * @param records - the current bindings.
 * @param live - Session ids the Host still lists.
 * @returns the bindings worth keeping.
 */
export function liveThreads(
  records: readonly ThreadRecord[], live: ReadonlySet<string>,
): readonly ThreadRecord[] {
  return records.filter(record => live.has(record.sessionId))
}
