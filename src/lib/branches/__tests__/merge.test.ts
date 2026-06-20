import { describe, it, expect } from 'vitest'
import { planMerge, cellKey, type Cell, type CellKey } from '../merge'

// Build a cell map from a plain record of "key::locale" → Cell
function mapOf(entries: Record<string, Cell>): Map<CellKey, Cell> {
  return new Map(Object.entries(entries))
}
const cell = (value: string | null, status: string | null = 'pending'): Cell => ({ value, status })

describe('cellKey', () => {
  it('joins key name and locale code', () => {
    expect(cellKey('auth.title', 'vi')).toBe('auth.title::vi')
  })
})

describe('planMerge — 3-way classification', () => {
  it('skips cells the source did not change (theirs == base)', () => {
    const base = mapOf({ [cellKey('a', 'vi')]: cell('Xin chào') })
    const ours = mapOf({ [cellKey('a', 'vi')]: cell('Xin chào sửa') }) // target changed
    const theirs = mapOf({ [cellKey('a', 'vi')]: cell('Xin chào') }) // source unchanged
    const plan = planMerge(base, ours, theirs)
    expect(plan.auto).toHaveLength(0)
    expect(plan.conflicts).toHaveLength(0)
  })

  it('auto-merges when target is untouched since fork', () => {
    const base = mapOf({ [cellKey('a', 'vi')]: cell('old') })
    const ours = mapOf({ [cellKey('a', 'vi')]: cell('old') }) // unchanged
    const theirs = mapOf({ [cellKey('a', 'vi')]: cell('new', 'approved') }) // source changed
    const plan = planMerge(base, ours, theirs)
    expect(plan.conflicts).toHaveLength(0)
    expect(plan.auto).toEqual([
      { keyName: 'a', localeCode: 'vi', value: 'new', status: 'approved', ours: cell('old') },
    ])
  })

  it('no-ops when both sides made the identical change', () => {
    const base = mapOf({ [cellKey('a', 'vi')]: cell('old') })
    const ours = mapOf({ [cellKey('a', 'vi')]: cell('same', 'reviewed') })
    const theirs = mapOf({ [cellKey('a', 'vi')]: cell('same', 'reviewed') })
    const plan = planMerge(base, ours, theirs)
    expect(plan.auto).toHaveLength(0)
    expect(plan.conflicts).toHaveLength(0)
  })

  it('flags a conflict when both sides changed differently', () => {
    const base = mapOf({ [cellKey('a', 'vi')]: cell('old') })
    const ours = mapOf({ [cellKey('a', 'vi')]: cell('ours') })
    const theirs = mapOf({ [cellKey('a', 'vi')]: cell('theirs') })
    const plan = planMerge(base, ours, theirs)
    expect(plan.auto).toHaveLength(0)
    expect(plan.conflicts).toEqual([
      { keyName: 'a', localeCode: 'vi', base: cell('old'), ours: cell('ours'), theirs: cell('theirs') },
    ])
  })

  it('treats a status-only change as a change', () => {
    const base = mapOf({ [cellKey('a', 'vi')]: cell('v', 'pending') })
    const ours = mapOf({ [cellKey('a', 'vi')]: cell('v', 'pending') })
    const theirs = mapOf({ [cellKey('a', 'vi')]: cell('v', 'approved') })
    const plan = planMerge(base, ours, theirs)
    expect(plan.auto).toHaveLength(1)
    expect(plan.auto[0]!.status).toBe('approved')
  })

  it('auto-adds a new key that exists only on source (not in base or target)', () => {
    const base = new Map<CellKey, Cell>()
    const ours = new Map<CellKey, Cell>()
    const theirs = mapOf({ [cellKey('new.key', 'en')]: cell('Hello') })
    const plan = planMerge(base, ours, theirs)
    expect(plan.conflicts).toHaveLength(0)
    expect(plan.auto).toEqual([
      { keyName: 'new.key', localeCode: 'en', value: 'Hello', status: 'pending', ours: null },
    ])
  })

  it('does NOT propagate a cell removed on source (delete not merged)', () => {
    // present in base + target, absent in theirs → not iterated, no plan entry
    const base = mapOf({ [cellKey('a', 'vi')]: cell('x') })
    const ours = mapOf({ [cellKey('a', 'vi')]: cell('x') })
    const theirs = new Map<CellKey, Cell>()
    const plan = planMerge(base, ours, theirs)
    expect(plan.auto).toHaveLength(0)
    expect(plan.conflicts).toHaveLength(0)
  })

  it('treats empty↔value transitions correctly (empty != value)', () => {
    const base = mapOf({ [cellKey('a', 'vi')]: cell(null, 'empty') })
    const ours = mapOf({ [cellKey('a', 'vi')]: cell(null, 'empty') })
    const theirs = mapOf({ [cellKey('a', 'vi')]: cell('filled', 'pending') })
    const plan = planMerge(base, ours, theirs)
    expect(plan.auto).toHaveLength(1)
    expect(plan.auto[0]!.value).toBe('filled')
  })

  it('handles a mix across many cells', () => {
    const base = mapOf({
      [cellKey('a', 'vi')]: cell('a0'),
      [cellKey('b', 'vi')]: cell('b0'),
      [cellKey('c', 'vi')]: cell('c0'),
    })
    const ours = mapOf({
      [cellKey('a', 'vi')]: cell('a0'),       // untouched
      [cellKey('b', 'vi')]: cell('b-ours'),   // target changed
      [cellKey('c', 'vi')]: cell('c0'),       // untouched
    })
    const theirs = mapOf({
      [cellKey('a', 'vi')]: cell('a-new'),    // source changed → auto
      [cellKey('b', 'vi')]: cell('b-theirs'), // both changed → conflict
      [cellKey('c', 'vi')]: cell('c0'),       // unchanged → skip
    })
    const plan = planMerge(base, ours, theirs)
    expect(plan.auto.map((a) => a.keyName)).toEqual(['a'])
    expect(plan.conflicts.map((c) => c.keyName)).toEqual(['b'])
  })
})
