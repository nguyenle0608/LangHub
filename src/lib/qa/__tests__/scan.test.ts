import { describe, it, expect } from 'vitest'
import { scanProjectQA, type ScanKey, type ScanTranslation, type ScanLocale } from '../scan'

const locales: ScanLocale[] = [
  { id: 'en', code: 'en', name: 'English', is_base: true },
  { id: 'es', code: 'es', name: 'Spanish', is_base: false },
]

const keys: ScanKey[] = [
  { id: 'k1', key: 'home.greeting' },
  { id: 'k2', key: 'cart.count' },
  { id: 'k3', key: 'clean.one' },
]

function tr(key_id: string, locale_id: string, value: string | null): ScanTranslation {
  return { key_id, locale_id, value }
}

describe('scanProjectQA', () => {
  it('aggregates issues across target locales and skips the base locale', () => {
    const translations: ScanTranslation[] = [
      tr('k1', 'en', 'Hello {name}'),
      tr('k1', 'es', 'Hola'), // missing {name}
      tr('k2', 'en', 'You have {} items'),
      tr('k2', 'es', 'Tienes {} elementos'), // clean
      tr('k3', 'en', 'OK'),
      tr('k3', 'es', 'OK '), // trailing whitespace
    ]
    const report = scanProjectQA(keys, translations, locales)

    expect(report.scanned).toBe(3)
    expect(report.rows).toHaveLength(2) // k1 and k3 have issues, k2 is clean
    expect(report.errorCount).toBe(1) // k1 placeholder-missing
    expect(report.warningCount).toBe(1) // k3 trailing-whitespace
    expect(report.byRule).toEqual(
      expect.arrayContaining([
        { rule: 'placeholder-missing', count: 1 },
        { rule: 'trailing-whitespace', count: 1 },
      ])
    )
    expect(report.rows.map((r) => r.key)).toEqual(['clean.one', 'home.greeting'])
  })

  it('ignores empty target values (untranslated) and empty source', () => {
    const translations: ScanTranslation[] = [
      tr('k1', 'en', 'Hello {name}'),
      tr('k1', 'es', ''), // untranslated → skipped
    ]
    const report = scanProjectQA(keys, translations, locales)
    expect(report.scanned).toBe(0)
    expect(report.rows).toHaveLength(0)
  })

  it('returns an empty report when there is no base locale', () => {
    const noBase: ScanLocale[] = locales.map((l) => ({ ...l, is_base: false }))
    const translations: ScanTranslation[] = [tr('k1', 'es', 'Hola {x}')]
    const report = scanProjectQA(keys, translations, noBase)
    // no base source to compare against → checkTranslation gets empty source → no issues
    expect(report.rows).toHaveLength(0)
  })

  it('sorts rows by key then locale', () => {
    const many: ScanLocale[] = [
      { id: 'en', code: 'en', name: 'English', is_base: true },
      { id: 'es', code: 'es', name: 'Spanish', is_base: false },
      { id: 'fr', code: 'fr', name: 'French', is_base: false },
    ]
    const translations: ScanTranslation[] = [
      tr('k2', 'en', '{name}'),
      tr('k1', 'en', '{name}'),
      tr('k2', 'fr', 'x'),
      tr('k2', 'es', 'y'),
      tr('k1', 'es', 'z'),
    ]
    const report = scanProjectQA(keys, translations, many)
    expect(report.rows.map((r) => `${r.key}:${r.localeCode}`)).toEqual([
      'cart.count:es',
      'cart.count:fr',
      'home.greeting:es',
    ])
  })
})
