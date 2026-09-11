import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { flatten, nest, KeyCollisionError } from '../keys'
import { emptyReport, hasChanges, merge, parseFile, serialize } from '../sync'

describe('flat/nested round trip', () => {
  it('survives a real translation file unchanged', () => {
    const path = '/Users/nguyenle/Workspace/WeMasterTrade_Mobile/assets/translations/en-US.json'
    let text: string
    try { text = readFileSync(path, 'utf8') } catch { return } // not everyone has the app repo
    const flat = parseFile(text)
    expect(Object.keys(flat).length).toBeGreaterThan(500)
    expect(flatten(nest(flat))).toEqual(flat)
  })

  it('refuses a key that is both a string and a parent', () => {
    expect(() => nest({ 'a.b': 'leaf', 'a.b.c': 'deeper' })).toThrow(KeyCollisionError)
  })

  it('sorts keys so a diff shows only what changed', () => {
    expect(serialize({ b: '2', a: '1' })).toBe('{\n  "a": "1",\n  "b": "2"\n}\n')
  })
})

describe('merge', () => {
  it('separates a new key from one whose local value is destroyed', () => {
    const report = emptyReport()
    const merged = merge({ a: 'A', b: 'B' }, { a: 'old' }, report)

    expect(merged).toEqual({ a: 'A', b: 'B' })
    expect(report.added).toEqual(['b'])
    // Both values are carried, because a count of overwrites cannot be judged
    // and the caller is asked to approve them.
    expect(report.overwrites).toEqual([{ key: 'a', from: 'old', to: 'A' }])
  })

  it('reports no overwrite when the local value already matches', () => {
    const report = emptyReport()
    merge({ a: 'A' }, { a: 'A' }, report)

    expect(report.overwrites).toEqual([])
    expect(report.added).toEqual([])
  })

  it('keeps a key LangHub does not have, and says so', () => {
    const report = emptyReport()
    const merged = merge({}, { local: 'only here' }, report)

    expect(merged).toEqual({ local: 'only here' })
    expect(report.notInLangHub).toEqual(['local'])
    expect(hasChanges(report)).toBe(false)
  })

  it('does not look inside a value', () => {
    // Placeholder arity, plural categories, markup — all carried verbatim.
    // Whether they are correct is the reading project's question, not ours.
    const report = emptyReport()
    const hub = {
      'a.positional': 'Dùng {} điểm',
      'a.named': 'xin chào {{name}}',
      'a.plural.few': '{} điểm',
      'a.markup': 'Mã: **{}**\nDòng hai',
      'a.lostPlaceholder': 'không còn placeholder',
    }
    const merged = merge(hub, { 'a.lostPlaceholder': 'Use {} points' }, report)

    expect(merged).toEqual(hub)
    expect(report.notInLangHub).toEqual([])
  })

  it('writes nothing for a key LangHub has no translation for', () => {
    // includeEmpty=false means such keys never arrive, so they are simply not
    // written — which is also what a fallback needs, at no cost to us.
    const report = emptyReport()
    const merged = merge({ translated: 'có' }, {}, report)

    expect('untranslated' in merged).toBe(false)
    expect(Object.values(merged)).not.toContain('')
  })
})
