// The rules behind the editor's status filters.
//
// Two filters use them: the sidebar Status list, which matches a key's overall
// status, and each language column's filter, which matches that one locale's
// translation. Both accept a set of statuses, and an empty set means the filter
// is off — that is the rule most easily written backwards, so it lives here
// once and is tested without a grid.

import type { TranslationStatus } from '@/types'

/** A status a filter can select. Reuses the status a translation already has. */
export type KeyStatus = TranslationStatus

/**
 * The natural progression of a translation's life, and the order the sidebar
 * lists it in. A Set preserves insertion order, so without this a filter would
 * label itself differently depending on the order the user clicked.
 */
export const STATUS_ORDER: readonly KeyStatus[] = ['empty', 'pending', 'reviewed', 'approved']

export const STATUS_LABEL: Record<KeyStatus, string> = {
  empty: 'Untranslated',
  pending: 'Pending',
  reviewed: 'Reviewed',
  approved: 'Approved',
}

/** Adds a status to the selection, or removes it if already there. Never mutates. */
export function toggleStatus(selected: ReadonlySet<KeyStatus>, status: KeyStatus): Set<KeyStatus> {
  const next = new Set(selected)
  if (next.has(status)) next.delete(status)
  else next.add(status)
  return next
}

/**
 * Whether a key's overall status passes the sidebar filter.
 *
 * Statuses within the filter combine with OR: a key carries exactly one overall
 * status, so requiring all of them would always match nothing.
 */
export function matchesKeyStatus(selected: ReadonlySet<KeyStatus>, keyStatus: KeyStatus): boolean {
  if (selected.size === 0) return true
  return selected.has(keyStatus)
}

/** The part of a translation a column filter reads. */
type TranslationLike = { value?: string | null; status?: string | null }

/**
 * Whether one locale's translation passes that column's filter.
 *
 * 'empty' covers a translation that is missing entirely or holds no value, not
 * only one whose status column says 'empty' — a row can have neither.
 */
export function matchesColumnStatus(
  selected: ReadonlySet<KeyStatus>,
  translation: TranslationLike | undefined,
): boolean {
  if (selected.size === 0) return true
  if (selected.has('empty') && (!translation?.value || translation.status === 'empty')) return true
  const status = translation?.status
  // 'empty' is settled above, so a row whose status column says 'empty' must not
  // match here as well — it would slip past a filter that did not select it.
  if (status == null || status === 'empty') return false
  return selected.has(status as KeyStatus)
}

/** The selected statuses as a chip label, in STATUS_ORDER regardless of click order. */
export function formatStatusList(selected: ReadonlySet<KeyStatus>): string {
  return STATUS_ORDER.filter((s) => selected.has(s)).map((s) => STATUS_LABEL[s]).join(', ')
}
