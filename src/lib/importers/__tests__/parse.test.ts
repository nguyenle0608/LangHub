import { describe, expect, it } from 'vitest'
import { assertImportBodySize, ImportValidationError, MAX_IMPORT_KEYS, MAX_PUBLIC_IMPORT_BYTES, parseImportContent, validateImportEntries } from '../parse'

describe('shared import parsing and bounds', () => {
  it('parses and namespaces JSON deterministically', () => {
    expect(parseImportContent({
      content: '{"title":"Hello","nested":{"cta":"Go"}}', filename: 'auth.json',
      format: 'json', importStructure: 'namespaced',
    }).entries).toEqual([
      { key: 'auth.title', value: 'Hello' },
      { key: 'auth.nested.cta', value: 'Go' },
    ])
  })

  it('accepts the key shapes real catalogs use', () => {
    expect(() => validateImportEntries([
      { key: 'about.aboutSection.aboutUsDetailsLabel', value: 'x' },
      { key: 'some-kebab-case.key_name', value: 'x' },
      { key: 'valid.key', value: 'x' },
    ])).not.toThrow()
  })

  it('rejects invalid keys and excessive values before mutation', () => {
    expect(() => validateImportEntries([{ key: 'has space', value: 'x' }])).toThrow(ImportValidationError)
    expect(() => validateImportEntries([{ key: 'has$symbol', value: 'x' }])).toThrow(ImportValidationError)
    expect(() => validateImportEntries([{ key: '', value: 'x' }])).toThrow(ImportValidationError)
    expect(() => validateImportEntries([{ key: 'x'.repeat(201), value: 'x' }])).toThrow(ImportValidationError)
    expect(() => validateImportEntries([{ key: 'valid.key', value: 'x'.repeat(100_001) }])).toThrow(/exceeds/)
  })

  it('rejects excessive key counts and public body sizes', () => {
    expect(() => validateImportEntries(Array.from({ length: MAX_IMPORT_KEYS + 1 }, (_, index) => ({ key: `key.${index}`, value: 'x' })))).toThrow(/key limit/)
    expect(() => assertImportBodySize(MAX_PUBLIC_IMPORT_BYTES + 1)).toThrow(/MiB/)
  })
})

describe('choosing a column of a multi-language sheet', () => {
  const tsv = 'Key\ten-US\ten-CA\nhome.cta\tColor\tColour\n'

  it('imports the named column, not the one whose code matches the locale', () => {
    // The locale is en-US but the caller asked for en-CA; guessing from the
    // code here is exactly how a language gets filled with the wrong text.
    const parsed = parseImportContent({
      content: tsv, filename: 'sheet.tsv', format: 'tsv', localeCode: 'en-US', column: 'en-CA',
    })
    expect(parsed.entries).toEqual([{ key: 'home.cta', value: 'Colour' }])
  })

  it('refuses a column the file does not have rather than importing another', () => {
    expect(() => parseImportContent({
      content: tsv, filename: 'sheet.tsv', format: 'tsv', column: 'fr-FR',
    })).toThrow(/fr-FR/)
  })

  it('still falls back to the locale code when no column is named', () => {
    const parsed = parseImportContent({
      content: tsv, filename: 'sheet.tsv', format: 'tsv', localeCode: 'en-CA',
    })
    expect(parsed.entries).toEqual([{ key: 'home.cta', value: 'Colour' }])
  })
})
