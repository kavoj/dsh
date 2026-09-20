/**
 * The SuiXing `@` source: every capability the four menus publish, offered to
 * any conversation in the client.
 *
 * This is the second half of "the business centres are usable from a normal
 * chat": the composer's menu is DSH's, the `@file` / `@session` source is the
 * base client's, and this registers one more source beside them. A pick inserts
 * a chip; the codec turns it into a tag that names the capability, its menu, and
 * its promise, so the model reads a reference rather than an unexplained label.
 *
 * Registration is additive in both directions. No service here replaces one of
 * the base client's, and where the trigger pipeline is absent the source simply
 * never registers — the catalogue, the settings pages, and the conversation
 * itself are unaffected.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {
  InputTriggerCandidate, InputTriggerSource, PickOutcome,
} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { CentersService } from '../centers/store.ts'
import { capabilityRows, type CapabilityRow } from '../directory/capabilities.ts'
import { DIRECTORY_NS } from '../directory/locales.ts'
import { DIRECTORY_GROUPS } from '../directory/specs.ts'
import {
  clipboardTextOf, matchReferences, parseReference, serializeReference, serializeUnresolved,
  toReference, type CapabilityReference,
} from './spec.ts'

/**
 * Register the source.
 * @param ctx - client root context carrying the locale and trigger services.
 * @param centers - the business-centre configuration the local capabilities
 *   come from, so something built from a sentence is referenceable at once.
 * @param openCapability - shows one capability in full; the chip's own verb.
 */
export function registerSuiXingReferences(
  ctx: ClientContext,
  centers: CentersService,
  openCapability: (groupId: string, id: string) => void,
): void {
  const triggers = ctx.get('inputTriggers')
  // The trigger pipeline belongs to its own client plugin. Where a build omits
  // it, the rest of the distribution still publishes and simply offers no `@`
  // source, instead of the whole plugin failing to apply.
  if (triggers === undefined) return
  const t = ctx.locale.bind(DIRECTORY_NS)
  const rows = (): readonly CapabilityRow[] =>
    capabilityRows(DIRECTORY_GROUPS, centers.getSnapshot(), t)
  const resolve = (ref: string): CapabilityReference | undefined => {
    const parsed = parseReference(ref)
    if (parsed === undefined) return undefined
    const row = rows().find(candidate =>
      candidate.groupId === parsed.groupId && candidate.id === parsed.id)
    return row === undefined ? undefined : toReference(row)
  }
  const source: InputTriggerSource = {
    trigger: '@',
    name: 'suixing',
    // After the base sources: `@file` and `@session` stay the primary reading
    // of a bare `@`, and a capability is the more specific thing to type.
    order: 10,
    // Every row names its own menu, so the source title would repeat the
    // section headings the rows already carry.
    showGroupTitle: false,
    candidates(_session, req) {
      return Promise.resolve(matchReferences(rows(), req.query).map(toCandidate))
    },
    // A plain `@name` typed back into a draft decorates as the reference it
    // names. The roll never changes while the plugin is loaded, so the source
    // declares no invalidation.
    lexicon() {
      return rows().map(row => row.label)
    },
    onPick({ candidate }): PickOutcome {
      const reference = readReference(candidate.value)
      if (reference === undefined) return undefined
      return {
        insert: {
          source: 'suixing',
          ref: reference.ref,
          label: reference.label,
          clipboardText: clipboardTextOf(reference),
        },
      }
    },
    openReference(_session, { ref }) {
      const parsed = parseReference(ref)
      // Claiming a handle this source does not own would send the user
      // nowhere; declining leaves the editor gesture exactly as it was.
      if (parsed === undefined) return false
      openCapability(parsed.groupId, parsed.id)
      return true
    },
    codec: {
      clipboardText: (ref) => {
        const reference = resolve(ref)
        return reference === undefined ? ref : clipboardTextOf(reference)
      },
      // Never a silent downgrade to plain text: a handle that no longer
      // resolves still travels as the same structured reference, minus the
      // readable fields — the send is never blocked on a stale capability.
      serialize: (ref) => {
        const reference = resolve(ref)
        return Promise.resolve(reference === undefined
          ? serializeUnresolved(ref)
          : serializeReference(reference))
      },
    },
  }
  ctx.effect(() => triggers.registerSource(source), 'ui-brand-suixing: capability @ source')
}

/** One menu row, carrying the reference as its opaque pick payload. */
function toCandidate(reference: CapabilityReference): InputTriggerCandidate {
  return {
    name: reference.label,
    description: reference.hint,
    section: reference.centre,
    value: JSON.stringify(reference),
  }
}

/** Read back a pick payload, rejecting anything this source did not write. */
function readReference(value: string | undefined): CapabilityReference | undefined {
  if (value === undefined) return undefined
  try {
    const parsed = JSON.parse(value) as Partial<CapabilityReference>
    return typeof parsed.ref === 'string' && typeof parsed.label === 'string'
      && typeof parsed.centre === 'string' && typeof parsed.hint === 'string'
      ? { ref: parsed.ref, label: parsed.label, centre: parsed.centre, hint: parsed.hint }
      : undefined
  } catch {
    return undefined
  }
}
