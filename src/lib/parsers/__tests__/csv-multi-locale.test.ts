import { describe, expect, it } from 'vitest'
import { parseCSV } from '../csv'

const TAB = '\t'
const tsv = (rows: string[][]) => rows.map((r) => r.join(TAB)).join('\n')

describe('parseCSV — delimited tables', () => {
  it('returns one result per locale column', () => {
    const results = parseCSV(tsv([
      ['Key', 'en-US', 'vi-VN', 'ja-JP'],
      ['app.title', 'Title', 'Tiêu đề', 'タイトル'],
    ]))

    expect(results.map((r) => r.locale)).toEqual(['en-US', 'vi-VN', 'ja-JP'])
    expect(results[0]!.keys).toEqual({ 'app.title': 'Title' })
    expect(results[1]!.keys).toEqual({ 'app.title': 'Tiêu đề' })
    expect(results[2]!.keys).toEqual({ 'app.title': 'タイトル' })
  })

  // A bare double quote is ordinary copy. Papa's default quoting read it as an
  // opening quote and desynchronised for the rest of the file.
  it('treats a double quote in a tab-separated field as text', () => {
    const results = parseCSV(tsv([
      ['Key', 'en-US'],
      ['hint.reason', 'Please enter the reason if you choose "Other"'],
      ['hint.after', 'This row must survive the one above'],
    ]))

    expect(results[0]!.keys).toEqual({
      'hint.reason': 'Please enter the reason if you choose "Other"',
      'hint.after': 'This row must survive the one above',
    })
    expect(results[0]!.errors).toEqual([])
  })

  it('still honours quoting in comma-separated files, where it is meaningful', () => {
    const results = parseCSV('Key,en-US\napp.list,"one, two, three"\n')
    expect(results[0]!.keys).toEqual({ 'app.list': 'one, two, three' })
  })

  it('accepts a first column that is not called Key, and says so', () => {
    const results = parseCSV(tsv([
      ['Lang', 'en-US'],
      ['app.title', 'Title'],
    ]))

    expect(results[0]!.errors).toEqual([])
    expect(results[0]!.keys).toEqual({ 'app.title': 'Title' })
    expect(results[0]!.warnings.join(' ')).toContain('Lang')
  })

  it('omits a key from a locale that has no value for it', () => {
    const results = parseCSV(tsv([
      ['Key', 'en-US', 'vi-VN'],
      ['only.english', 'Hello', ''],
    ]))

    expect(results[0]!.keys).toEqual({ 'only.english': 'Hello' })
    expect(results[1]!.keys).toEqual({})
  })

  it('reports rows with no key rather than importing them blank', () => {
    const results = parseCSV(tsv([
      ['Key', 'en-US'],
      ['', 'orphan value'],
      ['app.title', 'Title'],
    ]))

    expect(results[0]!.keys).toEqual({ 'app.title': 'Title' })
    expect(results[0]!.warnings.join(' ')).toContain('1 row')
  })

  it('errors when there is nothing after the key column', () => {
    const results = parseCSV('Key\napp.title\n')
    expect(results[0]!.errors[0]).toContain('No locale columns')
  })
})
