import { describe, it, expect } from 'vitest'
import { diffMaps } from '../diff'

type Cell = { value: string | null; status: string | null }
const cell = (value: string | null, status: string | null = 'pending'): Cell => ({ value, status })
const mapOf = (e: Record<string, Cell>) => new Map(Object.entries(e))

describe('diffMaps', () => {
  it('marks a cell present only in B as added', () => {
    const d = diffMaps(new Map(), mapOf({ 'a::vi': cell('x') }))
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ key_name: 'a', locale_code: 'vi', type: 'added', valueB: 'x', valueA: null })
  })

  it('marks a cell present only in A as removed', () => {
    const d = diffMaps(mapOf({ 'a::vi': cell('x') }), new Map())
    expect(d[0]).toMatchObject({ type: 'removed', valueA: 'x', valueB: null })
  })

  it('marks a differing value as changed', () => {
    const d = diffMaps(mapOf({ 'a::vi': cell('x') }), mapOf({ 'a::vi': cell('y') }))
    expect(d[0]).toMatchObject({ type: 'changed', valueA: 'x', valueB: 'y' })
  })

  it('marks a status-only difference as changed', () => {
    const d = diffMaps(mapOf({ 'a::vi': cell('x', 'pending') }), mapOf({ 'a::vi': cell('x', 'approved') }))
    expect(d[0]!.type).toBe('changed')
  })

  it('marks identical cells as unchanged', () => {
    const d = diffMaps(mapOf({ 'a::vi': cell('x', 'approved') }), mapOf({ 'a::vi': cell('x', 'approved') }))
    expect(d[0]!.type).toBe('unchanged')
  })

  it('orders changed → added → removed → unchanged, then by key name', () => {
    const A = mapOf({
      'same::vi': cell('s'),     // unchanged
      'gone::vi': cell('g'),     // removed
      'edit::vi': cell('e1'),    // changed
    })
    const B = mapOf({
      'same::vi': cell('s'),     // unchanged
      'edit::vi': cell('e2'),    // changed
      'add::vi': cell('a'),      // added
    })
    const types = diffMaps(A, B).map((d) => `${d.type}:${d.key_name}`)
    expect(types).toEqual(['changed:edit', 'added:add', 'removed:gone', 'unchanged:same'])
  })
})
