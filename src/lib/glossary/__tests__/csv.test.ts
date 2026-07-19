import { describe, it, expect } from 'vitest'
import { parseGlossaryCSV } from '../csv'

describe('parseGlossaryCSV', () => {
  it('parses valid rows with default case_sensitive/whole_word', () => {
    const csv = 'source_locale,target_locale,source_term,target_term\nen,vi,Sign in,Đăng nhập'
    const result = parseGlossaryCSV(csv)
    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      { sourceLocale: 'en', targetLocale: 'vi', sourceTerm: 'Sign in', targetTerm: 'Đăng nhập', caseSensitive: false, wholeWord: true },
    ])
  })

  it('parses explicit case_sensitive/whole_word booleans', () => {
    const csv = 'source_locale,target_locale,source_term,target_term,case_sensitive,whole_word\nen,vi,API,API,true,false'
    const result = parseGlossaryCSV(csv)
    expect(result.rows[0]).toMatchObject({ caseSensitive: true, wholeWord: false })
  })

  it('is tolerant of header case and column order', () => {
    const csv = 'Target_Term,Source_Term,Target_Locale,Source_Locale\nĐăng nhập,Sign in,vi,en'
    const result = parseGlossaryCSV(csv)
    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([
      { sourceLocale: 'en', targetLocale: 'vi', sourceTerm: 'Sign in', targetTerm: 'Đăng nhập', caseSensitive: false, wholeWord: true },
    ])
  })

  it('reports missing required columns without attempting to parse rows', () => {
    const csv = 'source_locale,target_locale\nen,vi'
    const result = parseGlossaryCSV(csv)
    expect(result.rows).toEqual([])
    expect(result.errors).toEqual(['Missing required column(s): source_term, target_term'])
  })

  it('rejects a row with an empty required field, keeping other rows', () => {
    const csv = [
      'source_locale,target_locale,source_term,target_term',
      'en,vi,Sign in,Đăng nhập',
      'en,vi,,Không có tên',
    ].join('\n')
    const result = parseGlossaryCSV(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toEqual(['Row 3: source_locale, target_locale, source_term, and target_term are all required'])
  })

  it('rejects identical source and target locales (case-insensitive)', () => {
    const csv = 'source_locale,target_locale,source_term,target_term\nEN,en,Sign in,Sign in'
    const result = parseGlossaryCSV(csv)
    expect(result.rows).toEqual([])
    expect(result.errors).toEqual(['Row 2: source_locale and target_locale must differ'])
  })

  it('rejects an invalid locale code', () => {
    const csv = 'source_locale,target_locale,source_term,target_term\nenglish,vi,Sign in,Đăng nhập'
    const result = parseGlossaryCSV(csv)
    expect(result.errors).toEqual(['Row 2: invalid source_locale "english"'])
  })

  it('rejects a term longer than 500 characters', () => {
    const csv = `source_locale,target_locale,source_term,target_term\nen,vi,${'a'.repeat(501)},x`
    const result = parseGlossaryCSV(csv)
    expect(result.errors).toEqual(['Row 2: source_term exceeds 500 characters'])
  })

  it('treats unrecognized boolean text as the default', () => {
    const csv = 'source_locale,target_locale,source_term,target_term,case_sensitive\nen,vi,Sign in,Đăng nhập,maybe'
    const result = parseGlossaryCSV(csv)
    expect(result.rows[0]?.caseSensitive).toBe(false)
  })

  it('parses fine when a row omits the optional trailing columns entirely (not just blank)', () => {
    // Row 2 has only 4 commas' worth of fields against a 6-column header —
    // a plain field-count mismatch, not malformed CSV — and must not discard
    // the whole file the way a genuine parse failure (e.g. bad quoting) would.
    const csv = [
      'source_locale,target_locale,source_term,target_term,case_sensitive,whole_word',
      'en,vi,Sign in,Đăng nhập,false,true',
      'en,vi,Workspace,Không gian làm việc',
    ].join('\n')
    const result = parseGlossaryCSV(csv)
    expect(result.rows).toEqual([
      { sourceLocale: 'en', targetLocale: 'vi', sourceTerm: 'Sign in', targetTerm: 'Đăng nhập', caseSensitive: false, wholeWord: true },
      { sourceLocale: 'en', targetLocale: 'vi', sourceTerm: 'Workspace', targetTerm: 'Không gian làm việc', caseSensitive: false, wholeWord: true },
    ])
  })

  it('still fails the whole file on genuinely malformed CSV (unterminated quote)', () => {
    const csv = 'source_locale,target_locale,source_term,target_term\nen,vi,"Sign in,Đăng nhập\n'
    const result = parseGlossaryCSV(csv)
    expect(result.rows).toEqual([])
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
