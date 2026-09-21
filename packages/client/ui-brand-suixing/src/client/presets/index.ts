/**
 * Binding a capability's new conversation to its role preset.
 *
 * The Host already owns the whole mechanism: an agent preset is the native
 * "this session answers as this role" concept, `agentPresets.select` accepts
 * it for a blank Session, and every surface that reads the Session's
 * `agentPreset` projection (the new-session chip, the conversation header)
 * then shows the role without SuiXing drawing anything. This module is only
 * the one call that hands the mapping over, made at the only moment it is
 * allowed — right after the Session is created and still blank.
 *
 * Every failure degrades to the Session the deployment would have started
 * anyway: a missing remote (a build without the presets bundle), a refused
 * swap, a race — the conversation still opens, it simply speaks in the
 * deployment's default voice. Nothing here may block starting work.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the `ctx.remote` merge (including `agentPresets`) in.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { presetFor } from './spec.ts'

/** The one agentPresets method this module uses, read off the merged remote. */
type AgentPresetsRemote = NonNullable<NonNullable<ClientContext['remote']>['agentPresets']>

/**
 * Assigning role presets to the conversations a capability starts.
 */
export interface RolePresets {
  /**
   * Give one just-created conversation its capability's role, if the
   * capability has one. Asynchronous on purpose: the caller must not wait
   * for the Host to answer before showing the conversation.
   * @param capabilityId - the capability the conversation was started for.
   * @param sessionId - the Session, expected blank and brand new.
   */
  assign(capabilityId: string, sessionId: string): void
}

/**
 * Read the `agentPresets` remote off the context without assuming it.
 * A build that assembles no gateway (or no presets bundle) has neither;
 * touching `ctx.remote` there may throw, and either way means no roles.
 * The structural read keeps the empty case a value, not an assumption:
 * the merged type promises a remote the runtime may not have mounted.
 * @param ctx - client root context.
 * @returns the remote, or undefined.
 */
function agentPresetsOf(ctx: ClientContext): AgentPresetsRemote | undefined {
  try {
    const holder = ctx as { remote?: { agentPresets?: AgentPresetsRemote } }
    return holder.remote?.agentPresets
  } catch {
    return undefined
  }
}

/**
 * Create the role-preset binding.
 * @param ctx - client root context.
 * @returns the binder, or undefined when this build has no presets remote —
 *   in which case conversations open exactly as they did before.
 */
export function createRolePresets(ctx: ClientContext): RolePresets | undefined {
  const remote = agentPresetsOf(ctx)
  if (remote === undefined) return undefined

  return {
    assign: (capabilityId, sessionId) => {
      const preset = presetFor(capabilityId)
      if (preset === undefined) return
      // The binding list holds plain ids; the Host addresses branded ones.
      void remote.select(sessionId as SessionId, preset).catch(() => {
        // The swap is a presentation choice, not a step of starting work;
        // a refusal leaves the deployment's default composition in place.
      })
    },
  }
}
