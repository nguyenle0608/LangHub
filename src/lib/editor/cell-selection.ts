// Geometry for the editor's Excel-style cell-range selection.
//
// Kept out of TranslationTable so the rules that decide what a selection covers
// — and which part of it may be written to — can be tested without a grid.

/**
 * The Key column's coordinate.
 *
 * It sits at -1 rather than shifting every locale to col + 1, so a locale's
 * column index stays its index in `visibleLocales` — the array every read and
 * write already looks it up in. -1 also sorts to the left of locale 0 on its
 * own, so normalizing a drag needs no special case for it.
 */
export const KEY_COL = -1

/** row indexes the visible key rows; col indexes visibleLocales, or KEY_COL. */
export type Cell = { row: number; col: number }

/** A normalized selection rectangle. All bounds are inclusive. */
export type SelectionBounds = { r0: number; r1: number; c0: number; c1: number }

/** Normalizes a drag (which may run in any direction) into a rectangle. */
export function selectionBounds(anchor: Cell, focus: Cell): SelectionBounds {
  return {
    r0: Math.min(anchor.row, focus.row),
    r1: Math.max(anchor.row, focus.row),
    c0: Math.min(anchor.col, focus.col),
    c1: Math.max(anchor.col, focus.col),
  }
}

export function selectionCellCount(bounds: SelectionBounds): number {
  return (bounds.r1 - bounds.r0 + 1) * (bounds.c1 - bounds.c0 + 1)
}

export function includesKeyColumn(bounds: SelectionBounds): boolean {
  return bounds.c0 <= KEY_COL
}

/**
 * The columns of a selection that may be written to.
 *
 * The Key column is readable — it can be selected and copied — but not
 * writable from the grid: a key is renamed through the detail panel, which is
 * owner-only and has to rewrite the key in every branch. Returns null when the
 * selection covers nothing but the Key column, so a caller can say why an
 * action did nothing instead of appearing to have worked.
 */
export function writableColumns(bounds: SelectionBounds): { c0: number; c1: number } | null {
  if (bounds.c1 < 0) return null
  return { c0: Math.max(bounds.c0, 0), c1: bounds.c1 }
}

/**
 * The selection as a grid of strings, for the clipboard. The Key column
 * contributes the key name; a locale column contributes the translation.
 *
 * Rows and columns that fall past the end of the table contribute an empty
 * cell rather than being dropped, so the copied block keeps the shape the user
 * selected.
 */
export function buildCopyGrid(
  bounds: SelectionBounds,
  rowKeyIds: readonly string[],
  localeIds: readonly string[],
  keyNameOf: (keyId: string) => string,
  valueOf: (keyId: string, localeId: string) => string,
): string[][] {
  const grid: string[][] = []
  for (let r = bounds.r0; r <= bounds.r1; r++) {
    const keyId = rowKeyIds[r]
    const line: string[] = []
    for (let c = bounds.c0; c <= bounds.c1; c++) {
      if (keyId == null) { line.push(''); continue }
      if (c === KEY_COL) { line.push(keyNameOf(keyId)); continue }
      const localeId = localeIds[c]
      line.push(localeId == null ? '' : valueOf(keyId, localeId))
    }
    grid.push(line)
  }
  return grid
}
