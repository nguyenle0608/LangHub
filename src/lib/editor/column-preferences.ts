/**
 * How one person has arranged one project's editor columns.
 *
 * Stored per browser rather than per account, for the same reason the theme is:
 * it is a local preference, and putting it in the database would buy
 * cross-device sync at the price of a table, a route, an RLS policy and a
 * loading state on a table that renders immediately today.
 */

export interface ColumnPreferences {
  /** Locale ids, in the order their columns appear. */
  order: string[]
  hidden: string[]
  frozen: string[]
  locked: string[]
  keyWidth: number | null
  /** Locale id -> pixel width. */
  localeWidths: Record<string, number>
}

/**
 * One key per project rather than one key holding every project.
 *
 * Reading or writing one project never touches another, so a corrupt entry
 * costs one project instead of all of them — and there is no read-modify-write
 * step, which is exactly where two tabs on different projects would lose each
 * other's changes.
 */
export function columnPreferencesKey(projectId: string): string {
  return `langhub-columns:${projectId}`
}

export function defaultColumnPreferences(): ColumnPreferences {
  // The key column starts frozen, matching the editor's own default.
  return { order: [], hidden: [], frozen: ['key'], locked: [], keyWidth: null, localeWidths: {} }
}

/**
 * Read stored preferences back, against the locales the project has today.
 *
 * Reconciliation happens here rather than when writing. Rewriting storage every
 * time a project's locales change would turn opening a project into a write,
 * and would lose a locale's remembered position for good if it were removed and
 * later added back. What is stored stays a statement of intent; the project's
 * current locales decide what that means now.
 *
 * Anything unreadable — absent, truncated, valid JSON of the wrong shape —
 * yields the default. A preference is not worth failing to open an editor over.
 */
export function parseColumnPreferences(raw: string | null, localeIds: string[]): ColumnPreferences {
  if (!raw) return defaultColumnPreferences()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return defaultColumnPreferences()
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return defaultColumnPreferences()
  }

  const value = parsed as Record<string, unknown>
  const known = new Set(localeIds)
  // 'key' and 'status' are columns too, and are not locales — they must survive
  // a filter that only knows about locale ids.
  const isColumn = (id: string) => known.has(id) || id === 'key' || id === 'status'

  return {
    // Only locales the project still has. Ones it has gained are absent, and
    // the editor already sorts unknown ids last, so they need nothing here.
    order: stringArray(value.order).filter((id) => known.has(id)),
    hidden: stringArray(value.hidden).filter(isColumn),
    frozen: stringArray(value.frozen).filter(isColumn),
    locked: stringArray(value.locked).filter(isColumn),
    keyWidth: positiveNumber(value.keyWidth),
    localeWidths: widthMap(value.localeWidths, known),
  }
}

export function serializeColumnPreferences(preferences: ColumnPreferences): string {
  return JSON.stringify(preferences)
}

export function readColumnPreferences(projectId: string, localeIds: string[]): ColumnPreferences {
  return parseColumnPreferences(safeRead(columnPreferencesKey(projectId)), localeIds)
}

export function writeColumnPreferences(projectId: string, preferences: ColumnPreferences): void {
  safeWrite(columnPreferencesKey(projectId), serializeColumnPreferences(preferences))
}

export function clearColumnPreferences(projectId: string): void {
  safeRemove(columnPreferencesKey(projectId))
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function widthMap(value: unknown, known: Set<string>): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, number> = {}
  for (const [id, width] of Object.entries(value as Record<string, unknown>)) {
    const valid = positiveNumber(width)
    if (valid !== null && known.has(id)) out[id] = valid
  }
  return out
}

/**
 * Storage access is wrapped rather than checked for.
 *
 * Private browsing and storage-blocking extensions throw on access instead of
 * returning null, so a guard on `typeof window` is not enough — the failure has
 * to be caught. Not remembering an arrangement is acceptable; refusing to open
 * the editor is not.
 */
function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Full, blocked, or unavailable. The arrangement is simply not remembered.
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // As above.
  }
}

/**
 * Move one locale to another's position.
 *
 * Extracted from the drop handler so the move itself can be tested without a
 * drag event. `current` is empty until the first reorder, which is why the
 * caller's full locale list is needed: without it the first drag would compute
 * positions against an empty array and do nothing.
 *
 * An id neither list knows, or a locale dropped on itself, leaves the order
 * untouched — the same array, so React re-renders nothing.
 */
export function moveLocale(current: string[], allIds: string[], sourceId: string, targetId: string): string[] {
  if (sourceId === targetId) return current
  const base = current.length ? current : allIds
  const from = base.indexOf(sourceId)
  const to = base.indexOf(targetId)
  if (from === -1 || to === -1) return current

  const next = [...base]
  next.splice(from, 1)
  next.splice(to, 0, sourceId)
  return next
}
