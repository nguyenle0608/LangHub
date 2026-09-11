import { describe, it, expect } from 'vitest'
import {
  KEY_COL,
  buildCopyGrid,
  includesKeyColumn,
  selectionBounds,
  selectionCellCount,
  writableColumns,
} from '../cell-selection'

describe('selectionBounds', () => {
  it('normalizes a drag made in any direction', () => {
    const forward = selectionBounds({ row: 1, col: 0 }, { row: 3, col: 2 })
    const backward = selectionBounds({ row: 3, col: 2 }, { row: 1, col: 0 })
    expect(forward).toEqual({ r0: 1, r1: 3, c0: 0, c1: 2 })
    expect(backward).toEqual(forward)
  })

  it('puts the key column left of locale 0 without a special case', () => {
    // Dragging right-to-left from a locale back into the Key column.
    expect(selectionBounds({ row: 0, col: 1 }, { row: 0, col: KEY_COL }))
      .toEqual({ r0: 0, r1: 0, c0: KEY_COL, c1: 1 })
  })
})

describe('selectionCellCount', () => {
  it('counts a single cell as one', () => {
    expect(selectionCellCount(selectionBounds({ row: 2, col: KEY_COL }, { row: 2, col: KEY_COL }))).toBe(1)
  })

  it('counts the key column as a column', () => {
    // 3 rows across Key + 2 locales.
    expect(selectionCellCount({ r0: 0, r1: 2, c0: KEY_COL, c1: 1 })).toBe(9)
  })
})

describe('includesKeyColumn', () => {
  it('is true only when the selection reaches the key column', () => {
    expect(includesKeyColumn({ r0: 0, r1: 0, c0: KEY_COL, c1: KEY_COL })).toBe(true)
    expect(includesKeyColumn({ r0: 0, r1: 0, c0: KEY_COL, c1: 2 })).toBe(true)
    expect(includesKeyColumn({ r0: 0, r1: 0, c0: 0, c1: 2 })).toBe(false)
  })
})

describe('writableColumns', () => {
  it('drops the key column from a mixed selection, keeping the locales aligned', () => {
    expect(writableColumns({ r0: 0, r1: 5, c0: KEY_COL, c1: 3 })).toEqual({ c0: 0, c1: 3 })
  })

  it('leaves a locale-only selection untouched', () => {
    expect(writableColumns({ r0: 0, r1: 5, c0: 1, c1: 3 })).toEqual({ c0: 1, c1: 3 })
  })

  it('returns null when nothing but the key column is selected', () => {
    expect(writableColumns({ r0: 0, r1: 9, c0: KEY_COL, c1: KEY_COL })).toBeNull()
  })
})

describe('buildCopyGrid', () => {
  const rows = ['k1', 'k2']
  const locales = ['en', 'vi']
  const names: Record<string, string> = { k1: 'home.title', k2: 'home.subtitle' }
  const values: Record<string, string> = {
    'k1:en': 'Hello', 'k1:vi': 'Xin chào',
    'k2:en': 'Welcome', 'k2:vi': '',
  }
  const keyNameOf = (id: string) => names[id] ?? ''
  const valueOf = (id: string, locale: string) => values[`${id}:${locale}`] ?? ''

  it('emits the key name for the key column', () => {
    const grid = buildCopyGrid({ r0: 0, r1: 1, c0: KEY_COL, c1: KEY_COL }, rows, locales, keyNameOf, valueOf)
    expect(grid).toEqual([['home.title'], ['home.subtitle']])
  })

  it('puts the key name left of the translations in a mixed selection', () => {
    const grid = buildCopyGrid({ r0: 0, r1: 1, c0: KEY_COL, c1: 1 }, rows, locales, keyNameOf, valueOf)
    expect(grid).toEqual([
      ['home.title', 'Hello', 'Xin chào'],
      ['home.subtitle', 'Welcome', ''],
    ])
  })

  it('keeps the selected shape when the selection runs past the table', () => {
    const grid = buildCopyGrid({ r0: 1, r1: 2, c0: KEY_COL, c1: 2 }, rows, locales, keyNameOf, valueOf)
    expect(grid).toEqual([
      ['home.subtitle', 'Welcome', '', ''],
      ['', '', '', ''],
    ])
  })
})
