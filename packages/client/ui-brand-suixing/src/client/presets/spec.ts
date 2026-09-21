/**
 * Which agent preset a capability's conversations open with.
 *
 * A capability whose conversation is expected to answer *as that capability*
 * maps to an agent preset the deployment ships (`packages/preset/agent-presets/
 * presets/<id>/`). The mapping is data: adding a role is adding a preset
 * directory and one row here — no code paths change.
 *
 * Capabilities without a row keep the behaviour they always had: the Session
 * runs the deployment's default composition.
 */

/** Capability id → agent preset id, for capabilities that speak in role. */
export const CAPABILITY_PRESETS: Readonly<Record<string, string>> = {
  chief: 'suixing-chief',
}

/**
 * The preset one capability's conversations open with, if any.
 * @param capabilityId - the capability starting a conversation.
 * @returns the preset id, or undefined when the capability has no role.
 */
export function presetFor(capabilityId: string): string | undefined {
  return CAPABILITY_PRESETS[capabilityId]
}
