import { describe, expect, it } from 'vitest'
import { parseCSV, parseTSV } from '../csv'

const TAB = '\t'
const tsv = (rows: string[][]) => rows.map((r) => r.join(TAB)).join('\n')
const csv = (rows: string[][]) => rows.map((r) => r.join(',')).join('\n')

// CSV and TSV are separate formats; the caller says which, nothing is sniffed.
describe.each([
  { name: 'parseTSV', parse: parseTSV, table: tsv },
  { name: 'parseCSV', parse: parseCSV, table: csv },
])('$name', ({ parse, table }) => {
  it('returns one result per locale column', () => {
    const results = parse(table([
      ['Key', 'en-US', 'vi-VN', 'ja-JP'],
      ['app.title', 'Title', 'Tiêu đề', 'タイトル'],
    ]))

    expect(results.map((r) => r.locale)).toEqual(['en-US', 'vi-VN', 'ja-JP'])
    expect(results[0]!.keys).toEqual({ 'app.title': 'Title' })
    expect(results[1]!.keys).toEqual({ 'app.title': 'Tiêu đề' })
    expect(results[2]!.keys).toEqual({ 'app.title': 'タイトル' })
  })

  it('accepts a first column that is not called Key, and says so', () => {
    const results = parse(table([['Lang', 'en-US'], ['app.title', 'Title']]))

    expect(results[0]!.errors).toEqual([])
    expect(results[0]!.keys).toEqual({ 'app.title': 'Title' })
    expect(results[0]!.warnings.join(' ')).toContain('Lang')
  })

  it('omits a key from a locale that has no value for it', () => {
    const results = parse(table([
      ['Key', 'en-US', 'vi-VN'],
      ['only.english', 'Hello', ''],
    ]))

    expect(results[0]!.keys).toEqual({ 'only.english': 'Hello' })
    expect(results[1]!.keys).toEqual({})
  })

  it('reports rows with no key rather than importing them blank', () => {
    const results = parse(table([
      ['Key', 'en-US'],
      ['', 'orphan value'],
      ['app.title', 'Title'],
    ]))

    expect(results[0]!.keys).toEqual({ 'app.title': 'Title' })
    expect(results[0]!.warnings.join(' ')).toContain('1 row')
  })

  it('errors when there is nothing after the key column', () => {
    const results = parse(table([['Key'], ['app.title']]))
    expect(results[0]!.errors[0]).toContain('No locale columns')
  })
})

describe('format-specific quoting', () => {
  // A bare quote is ordinary copy in a TSV; Papa's default reading of it as an
  // opening quote cost 41 of 690 rows on a real export.
  it('TSV treats a double quote as text', () => {
    const results = parseTSV(tsv([
      ['Key', 'en-US'],
      ['hint.reason', 'Please enter the reason if you choose "Other"'],
      ['hint.after', 'This row must survive the one above'],
    ]))

    expect(results[0]!.keys).toEqual({
      'hint.reason': 'Please enter the reason if you choose "Other"',
      'hint.after': 'This row must survive the one above',
    })
  })

  it('TSV keeps a comma as text — it is not a delimiter here', () => {
    const results = parseTSV(tsv([['Key', 'en-US'], ['app.list', 'one, two, three']]))
    expect(results[0]!.keys).toEqual({ 'app.list': 'one, two, three' })
  })

  it('CSV honours quoting, where a comma inside a value needs it', () => {
    const results = parseCSV('Key,en-US\napp.list,"one, two, three"\n')
    expect(results[0]!.keys).toEqual({ 'app.list': 'one, two, three' })
  })

  it('CSV keeps a tab as text — it is not a delimiter here', () => {
    const results = parseCSV('Key,en-US\napp.indent,a\tb\n')
    expect(results[0]!.keys).toEqual({ 'app.indent': 'a\tb' })
  })
})
