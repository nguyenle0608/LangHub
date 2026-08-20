import { describe, expect, it } from 'vitest'
import { autoMapColumns, suggestedLocaleCode } from '../delimited-columns'

const locales = [
  { id: 'l-en', code: 'en' },
  { id: 'l-vi', code: 'vi-VN' },
  { id: 'l-ja', code: 'ja' },
]

describe('autoMapColumns', () => {
  it('matches an exact code', () => {
    expect(autoMapColumns(['vi-VN'], locales)).toEqual({ 'vi-VN': 'l-vi' })
  })

  it('matches regardless of case or separator', () => {
    expect(autoMapColumns(['vi_vn', 'JA'], locales)).toEqual({ vi_vn: 'l-vi', JA: 'l-ja' })
  })

  it('falls back to the same language in another region', () => {
    // The sheet is regional, the project is not — still the right column.
    expect(autoMapColumns(['en-GB'], locales)).toEqual({ 'en-GB': 'l-en' })
    expect(autoMapColumns(['vi'], locales)).toEqual({ vi: 'l-vi' })
  })

  it('gives an exact match precedence over a looser one listed first', () => {
    const mapping = autoMapColumns(['en-US', 'en'], locales)
    expect(mapping).toEqual({ 'en-US': '', en: 'l-en' })
  })

  it('never assigns one language to two columns', () => {
    const mapping = autoMapColumns(['en-US', 'en-CA', 'en-IN'], locales)
    const assigned = Object.values(mapping).filter(Boolean)
    expect(assigned).toEqual(['l-en'])
  })

  it('leaves a column the project has no language for unassigned', () => {
    expect(autoMapColumns(['ko-KR'], locales)).toEqual({ 'ko-KR': '' })
  })

  it('leaves a column that is not a locale at all unassigned', () => {
    expect(autoMapColumns(['Screen', 'Notes'], locales)).toEqual({ Screen: '', Notes: '' })
  })
})

describe('suggestedLocaleCode', () => {
  it('canonicalises a code worth creating', () => {
    expect(suggestedLocaleCode('ko_kr')).toBe('ko-KR')
    expect(suggestedLocaleCode(' fa ')).toBe('fa')
  })

  it('suggests nothing for a column that is not a locale', () => {
    expect(suggestedLocaleCode('Screen')).toBeNull()
    expect(suggestedLocaleCode('English (Canada)')).toBeNull()
  })
})
