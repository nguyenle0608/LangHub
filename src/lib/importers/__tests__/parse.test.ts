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

  it('rejects invalid keys and excessive values before mutation', () => {
    expect(() => validateImportEntries([{ key: 'Invalid-Key', value: 'x' }])).toThrow(ImportValidationError)
    expect(() => validateImportEntries([{ key: 'valid.key', value: 'x'.repeat(100_001) }])).toThrow(/exceeds/)
  })

  it('rejects excessive key counts and public body sizes', () => {
    expect(() => validateImportEntries(Array.from({ length: MAX_IMPORT_KEYS + 1 }, (_, index) => ({ key: `key.${index}`, value: 'x' })))).toThrow(/key limit/)
    expect(() => assertImportBodySize(MAX_PUBLIC_IMPORT_BYTES + 1)).toThrow(/MiB/)
  })
})

