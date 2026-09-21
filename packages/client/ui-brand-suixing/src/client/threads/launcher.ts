/**
 * Starting a conversation for a capability.
 *
 * The conversation is an ordinary Session — the Host creates it, the Session
 * Controller lists it, the conversation panel renders it — but it is born
 * outside every Workspace, so the workspace tree never claims it and it stays
 * a child of its capability alone (the tree drops bound ids through the
 * `sessionTreeExclusion` service). This module decides *where* it is born and
 * remembers *who* asked for it.
 *
 * Role is the Host's own concept too: a capability that speaks in role maps
 * to an agent preset (`presets/spec.ts`), and the binding below hands the
 * just-created blank Session to `agentPresets.select` — the same native path
 * the new-session chip uses. The conversation never gets narrated capability
 * instructions by this module; a capability without a preset runs the
 * deployment's default composition, exactly as before.
 */
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ThreadsService } from './store.ts'
import type { RolePresets } from '../presets/index.ts'

/** Starting and returning to a capability's conversations. */
export interface ThreadLauncher {
  /**
   * Whether the session services this launcher needs are present. A build
   * without them still publishes the catalogue; only the start control falls
   * back to the shell's own New Session surface.
   */
  readonly available: boolean
  /**
   * Start a conversation for one capability and show it.
   * @param capabilityId - the capability to start work for.
   */
  start(capabilityId: string): void
  /**
   * Show one conversation already bound to a capability.
   * @param sessionId - the Session to display.
   */
  open(sessionId: string): void
  /**
   * Rename one conversation (the Host's own session title).
   * @param sessionId - the Session to retitle.
   * @param title - the user's title, already trimmed.
   */
  rename(sessionId: string, title: string): Promise<void>
  /**
   * Remove one conversation from the sidebar by archiving the Session —
   * the Host's own hide-with-recall semantics, never a log deletion.
   * @param sessionId - the Session to archive.
   */
  remove(sessionId: string): Promise<void>
}

/** Services the launcher needs; both ship with the assembled web client. */
interface ThreadServices {
  readonly sessions: ISessions
  readonly uiWorkspace: UiWorkspace
}

/**
 * Resolve the session services, or nothing when this build lacks them.
 * @param ctx - client root context.
 * @returns the services, or undefined.
 */
export function threadServices(ctx: ClientContext): ThreadServices | undefined {
  const sessions = ctx.get('sessions')
  const uiWorkspace = ctx.get('uiWorkspace')
  return sessions === undefined || uiWorkspace === undefined
    ? undefined
    : { sessions, uiWorkspace }
}

/**
 * Create the launcher.
 * @param ctx - client root context.
 * @param threads - the binding store the new conversation is recorded in.
 * @param rolePresets - the capability→preset binder; absent (a build without
 *   the presets remote, or callers that skip it) conversations open on the
 *   deployment's default composition, exactly as they did before.
 * @returns the launcher; with the session services absent it reports itself
 *   unavailable and both actions are inert.
 */
export function createThreadLauncher(
  ctx: ClientContext,
  threads: ThreadsService,
  rolePresets?: RolePresets,
): ThreadLauncher {
  const services = threadServices(ctx)
  if (services === undefined) {
    return {
      available: false,
      start: () => {},
      open: () => {},
      rename: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    }
  }
  const { sessions, uiWorkspace } = services

  const start = (capabilityId: string): void => {
    void begin(capabilityId).catch((reason: unknown) => {
      console.warn('suixing: starting a capability conversation failed:', reason)
    })
  }

  /**
   * A capability conversation is born outside every Workspace: created
   * without one, it never enters the workspace tree's groups, so it stays a
   * child of its capability alone (the tree drops bound ids through the
   * `sessionTreeExclusion` service). The navigation hands the Session id back
   * after the create resolves, which is the only moment the caller learns it
   * — selecting it is half of what "开始对话" means.
   * @param capabilityId - the capability to start work for.
   */
  const begin = async (capabilityId: string): Promise<void> => {
    const sessionId = await sessions.create({})
    threads.bind(capabilityId, sessionId)
    // Open first: the conversation is the product, and the role below is
    // presentation — a binder failure must never leave the user on the page
    // they started from. The session is still blank here, so `select` applies.
    uiWorkspace.openSession(sessionId)
    rolePresets?.assign(capabilityId, sessionId)
  }

  return {
    available: true,
    start,
    // The binding list holds plain ids — it is browser-local data, persisted
    // as text. This is the one boundary where that id becomes a Session the
    // Controller will address.
    open: (sessionId) => { uiWorkspace.openSession(sessionId as SessionId) },
    // The same rename path the workspace browser's own row menu drives: the
    // Host session face, taken through a reference so the title change is
    // the Host's, not a local overlay.
    rename: async (sessionId, title) => {
      const result = await sessions.using(
        sessionId as SessionId,
        { source: 'workspaceOperation' },
        reference => reference.binding.session.rename(title),
      )
      if (!result.ok) throw new Error(result.error.message)
    },
    remove: async (sessionId) => { await uiWorkspace.archiveSession(sessionId as SessionId) },
  }
}
