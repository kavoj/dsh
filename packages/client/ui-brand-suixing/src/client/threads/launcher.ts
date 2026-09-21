/**
 * Starting a conversation for a capability.
 *
 * The conversation is an ordinary Session: the Host creates it, the Session
 * Controller lists it, the conversation panel renders it, and the workspace
 * browser keeps showing it exactly as it shows any other. This module only
 * decides *where* it is born and remembers *who* asked for it — which is what
 * lets the sidebar nest it under that capability instead of losing it in a
 * list of every conversation in the workspace.
 *
 * The conversation itself stays an ordinary Session: the Host creates it, the
 * Session Controller lists it, the conversation panel renders it, and the
 * workspace browser keeps showing it exactly as it shows any other. This
 * module only decides *where* it is born and remembers *who* asked for it —
 * which is what lets the sidebar nest it under that capability instead of
 * losing it in a list of every conversation in the workspace.
 *
 * Role is the Host's own concept too: a capability that speaks in role maps
 * to an agent preset (`presets/spec.ts`), and the binding below hands the
 * just-created blank Session to `agentPresets.select` — the same native path
 * the new-session chip uses. The conversation never gets narrated capability
 * instructions by this module; a capability without a preset runs the
 * deployment's default composition, exactly as before.
 */
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces, WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
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
}

/** Services the launcher needs; all three ship with the assembled web client. */
interface ThreadServices {
  readonly sessions: ISessions
  readonly uiWorkspace: UiWorkspace
  readonly workspaces: IWorkspaces
}

/**
 * Resolve the session services, or nothing when this build lacks them.
 * @param ctx - client root context.
 * @returns the services, or undefined.
 */
export function threadServices(ctx: ClientContext): ThreadServices | undefined {
  const sessions = ctx.get('sessions')
  const uiWorkspace = ctx.get('uiWorkspace')
  const workspaces = ctx.get('workspaces')
  return sessions === undefined || uiWorkspace === undefined || workspaces === undefined
    ? undefined
    : { sessions, uiWorkspace, workspaces }
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
    return { available: false, start: () => {}, open: () => {} }
  }
  const { sessions, uiWorkspace, workspaces } = services

  const start = (capabilityId: string): void => {
    void begin(capabilityId).catch((reason: unknown) => {
      console.warn('suixing: starting a capability conversation failed:', reason)
    })
  }

  /**
   * Land the conversation where this user is already working, and bind it on
   * the way in. The navigation hands the Session id back *before* it opens the
   * conversation, which is the only moment the caller learns it — the Session
   * Controller's older create path returns one without selecting it, and
   * selecting it is half of what "开始对话" means.
   * @param capabilityId - the capability to start work for.
   */
  const begin = async (capabilityId: string): Promise<void> => {
    const target = currentWorkspace()
    if (target === undefined) {
      const sessionId = await sessions.create({})
      threads.bind(capabilityId, sessionId)
      rolePresets?.assign(capabilityId, sessionId)
      uiWorkspace.openSession(sessionId)
      return
    }
    await uiWorkspace.openWorkspace(target, (sessionId) => {
      threads.bind(capabilityId, sessionId)
      rolePresets?.assign(capabilityId, sessionId)
    })
  }

  /**
   * The workspace this conversation should belong to: the one already on
   * screen, else the most recently touched, exactly the policy the sidebar's
   * own New Session control resolves. A conversation a capability starts is
   * still a workspace's conversation.
   * @returns the workspace, or undefined when the browser knows of none yet.
   */
  const currentWorkspace = (): WorkspaceId | undefined => {
    const list = workspaces.list.getSnapshot()
    const known = sessions.list.getSnapshot()
    if (list.phase !== 'ready' || known.phase !== 'ready') return undefined
    const onScreen = Object.values(known.byId)
      .find(session => (session.retainedBy.mainView ?? 0) > 0)?.id
    const owner = onScreen === undefined
      ? undefined
      : list.items.find(item => item.sessionIds.includes(onScreen))?.workspaceId
    if (owner !== undefined) return owner
    let latest: WorkspaceId | undefined
    let latestAt = Number.NEGATIVE_INFINITY
    for (const item of list.items) {
      let touched = Number.NEGATIVE_INFINITY
      for (const sessionId of item.sessionIds) {
        const summary = known.byId[sessionId]
        if (summary !== undefined) touched = Math.max(touched, summary.updatedAt)
      }
      // A workspace nobody has talked in yet is dated from its own creation,
      // so a fresh install still has somewhere to start a conversation.
      if (touched === Number.NEGATIVE_INFINITY) touched = Date.parse(item.createdAt)
      if (latest === undefined || touched > latestAt) {
        latest = item.workspaceId
        latestAt = touched
      }
    }
    return latest
  }

  return {
    available: true,
    start,
    // The binding list holds plain ids — it is browser-local data, persisted
    // as text. This is the one boundary where that id becomes a Session the
    // Controller will address.
    open: (sessionId) => { uiWorkspace.openSession(sessionId as SessionId) },
  }
}
