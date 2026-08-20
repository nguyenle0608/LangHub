import { describe, expect, it } from 'vitest'
import { allKeysOf, applyGroupSelection, computeSkipKeys, countSelected } from '../selection'

const file = {
  newKeys: ['a.new', 'b.new'],
  fillKeys: ['c.fill'],
  duplicateKeys: ['d.dupe', 'e.dupe'],
}

describe('import preview selection', () => {
  it('spans all three preview groups', () => {
    expect(allKeysOf(file)).toEqual(['a.new', 'b.new', 'c.fill', 'd.dupe', 'e.dupe'])
    expect(allKeysOf({})).toEqual([])
  })

  it('counts selections per group', () => {
    const selected = new Set(['a.new', 'd.dupe'])
    expect(countSelected(file.newKeys, selected)).toBe(1)
    expect(countSelected(file.fillKeys, selected)).toBe(0)
    expect(countSelected(file.duplicateKeys, selected)).toBe(1)
    expect(countSelected(undefined, selected)).toBe(0)
    expect(countSelected(file.newKeys, undefined)).toBe(0)
  })

  it('lets new keys be de-selected instead of force-importing them', () => {
    const selected = new Set(allKeysOf(file))
    expect(computeSkipKeys(file, selected)).toEqual([])

    selected.delete('a.new')
    expect(computeSkipKeys(file, selected)).toEqual(['a.new'])
  })

  it('skips everything when nothing is selected', () => {
    expect(computeSkipKeys(file, new Set())).toEqual(allKeysOf(file))
    expect(computeSkipKeys(file, undefined)).toEqual(allKeysOf(file))
  })

  it('applies All/None to one group without touching the others', () => {
    const selected = new Set(['d.dupe'])

    const withNew = applyGroupSelection(selected, file.newKeys, true)
    expect(Array.from(withNew).sort()).toEqual(['a.new', 'b.new', 'd.dupe'])

    // Clearing the new-keys group must leave the duplicate overwrite ticked.
    const clearedNew = applyGroupSelection(withNew, file.newKeys, false)
    expect(Array.from(clearedNew)).toEqual(['d.dupe'])
  })

  it('does not mutate the set it is given', () => {
    const selected = new Set(['d.dupe'])
    applyGroupSelection(selected, file.newKeys, true)
    expect(Array.from(selected)).toEqual(['d.dupe'])
  })

  it('covers group keys beyond the rendered preview cap', () => {
    const many = Array.from({ length: 1191 }, (_, i) => `key.${i}`)
    const selected = applyGroupSelection(new Set(), many, true)
    expect(selected.size).toBe(1191)
    expect(computeSkipKeys({ newKeys: many }, selected)).toEqual([])
  })
})
