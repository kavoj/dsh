/**
 * Capabilities as `@` references.
 *
 * A conversation should be able to name the work it is about — the agent that
 * owns it, the scenario that runs it, the creation it produces — instead of
 * describing it in prose and hoping. DSH already has the mechanism: an `@`
 * source contributes candidates to the composer's menu, the pick inserts a
 * chip, and a codec says what the model actually reads. This module is the
 * SuiXing source's data half: one reference per capability, and the tag the
 * model receives in place of the chip.
 *
 * Pure on purpose — the wiring, the menu, and the detail page live next door.
 */
import type { CapabilityRow } from '../directory/capabilities.ts'

/** Every capability reference starts here, so a ref is recognisable on sight. */
export const REF_PREFIX = 'suixing'

/** Rows the `@` menu offers at once, matching the composer menu's budget. */
export const REFERENCE_LIMIT = 10

/** One capability as the composer sees it. */
export interface CapabilityReference {
  /** Opaque, stable handle: what the chip carries and the codec resolves. */
  readonly ref: string
  /** The name the user picks and the chip shows. */
  readonly label: string
  /** The menu it lives in, so the `@` menu can section its rows. */
  readonly centre: string
  /** One-line promise, as the menu's secondary text. */
  readonly hint: string
}

/**
 * Build one capability's handle.
 * @param groupId - owning menu id.
 * @param id - the capability's id.
 * @returns the reference.
 */
export function referenceOf(groupId: string, id: string): string {
  return `${REF_PREFIX}/${groupId}/${id}`
}

/**
 * Read a handle back.
 * @param ref - the reference.
 * @returns its parts, or undefined when the ref is not one of ours.
 */
export function parseReference(ref: string): { groupId: string; id: string } | undefined {
  const parts = ref.split('/')
  if (parts.length !== 3 || parts[0] !== REF_PREFIX) return undefined
  const [, groupId, id] = parts
  /* v8 ignore next -- a three-part split of a three-part ref always fills all three. */
  if (groupId === undefined || id === undefined || groupId === '' || id === '') return undefined
  return { groupId, id }
}

/**
 * Project one flattened capability onto a reference.
 * @param row - the flattened capability.
 * @returns the reference the composer carries.
 */
export function toReference(row: CapabilityRow): CapabilityReference {
  return {
    ref: referenceOf(row.groupId, row.id),
    label: row.label,
    centre: row.groupTitle,
    hint: row.hint,
  }
}

/**
 * The rows one query offers: everything on an empty query, else the
 * capabilities whose name, promise, menu, or id contains the query.
 * @param rows - every published capability.
 * @param query - the live query text after `@`.
 * @param limit - maximum rows to offer.
 * @returns the matching references, in menu order.
 */
export function matchReferences(
  rows: readonly CapabilityRow[], query: string, limit = REFERENCE_LIMIT,
): readonly CapabilityReference[] {
  const needle = query.trim().toLowerCase()
  const candidates = needle === ''
    ? rows
    : rows.filter(row => `${row.label} ${row.hint} ${row.groupTitle} ${row.id}`
      .toLowerCase().includes(needle))
  return candidates.slice(0, limit).map(toReference)
}

/**
 * What the model reads in place of the chip: the capability named as a thing,
 * with the menu it belongs to and the promise it makes, so a conversation can
 * act on the reference instead of echoing a label back.
 * @param reference - the picked reference.
 * @returns one XML-ish tag; the wire text of the inserted chip.
 */
export function serializeReference(reference: CapabilityReference): string {
  return `<suixing-capability id="${escapeAttribute(reference.ref)}"`
    + ` centre="${escapeAttribute(reference.centre)}"`
    + ` name="${escapeAttribute(reference.label)}">`
    + `${escapeText(reference.hint)}</suixing-capability>`
}

/**
 * The tag for a handle this distribution can no longer resolve — a capability
 * the deployment shipped last time and not this one. Same shape as a resolved
 * reference, minus the readable fields, so the send is never blocked and the
 * conversation still sees that something was named.
 * @param ref - the stale handle.
 * @returns one XML-ish tag; the wire text of the inserted chip.
 */
export function serializeUnresolved(ref: string): string {
  return `<suixing-capability id="${escapeAttribute(ref)}"/>`
}

/**
 * The text a reference copies and pastes as. The composer decorates a plain
 * `@name` back into a reference, so a copied one survives a round trip
 * through a draft.
 * @param reference - the reference.
 * @returns the clipboard projection.
 */
export function clipboardTextOf(reference: CapabilityReference): string {
  return `@${reference.label}`
}

/** Keep a dictionary value from breaking out of an XML attribute. */
function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Keep a dictionary value from breaking out of an XML text node. */
function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
