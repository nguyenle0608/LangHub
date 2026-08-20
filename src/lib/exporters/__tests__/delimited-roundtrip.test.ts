import { describe, expect, it } from 'vitest'
import { exportCSV, exportTSV } from '../csv'
import { parseCSV, parseTSV } from '@/lib/parsers/csv'

const keys = ['app.title', 'app.list', 'app.quote', 'app.multiline', 'app.tabbed']
const locales = ['en-US', 'vi-VN']

const values: Record<string, Record<string, string>> = {
  'app.title': { 'en-US': 'Title', 'vi-VN': 'Tiêu đề' },
  // Each of these broke one delimiter or the other at some point.
  'app.list': { 'en-US': 'one, two, three', 'vi-VN': 'một, hai, ba' },
  'app.quote': { 'en-US': 'choose "Other"', 'vi-VN': 'chọn "Khác"' },
  'app.multiline': { 'en-US': 'first line\nsecond line', 'vi-VN': 'dòng một\ndòng hai' },
  'app.tabbed': { 'en-US': 'left\tright', 'vi-VN': 'trái\tphải' },
}

describe.each([
  { name: 'CSV', write: exportCSV, read: parseCSV },
  { name: 'TSV', write: exportTSV, read: parseTSV },
])('$name round trip', ({ write, read }) => {
  const results = read(write(keys, locales, values))

  it('comes back with the same locale columns', () => {
    expect(results.map((r) => r.locale)).toEqual(locales)
  })

  it.each(keys)('preserves %s in every locale', (key) => {
    locales.forEach((locale, index) => {
      expect(results[index]!.keys[key]).toBe(values[key]![locale])
    })
  })
})

describe('what each format quotes', () => {
  it('CSV quotes a comma; TSV leaves it alone', () => {
    expect(exportCSV(['k'], ['en'], { k: { en: 'a, b' } })).toContain('"a, b"')
    expect(exportTSV(['k'], ['en'], { k: { en: 'a, b' } })).toContain('a, b')
  })

  it('TSV quotes a tab; CSV leaves it alone', () => {
    expect(exportTSV(['k'], ['en'], { k: { en: 'a\tb' } })).toContain('"a\tb"')
    expect(exportCSV(['k'], ['en'], { k: { en: 'a\tb' } })).toContain('a\tb')
  })

  it('both quote a newline, so the value can be rebuilt on the way in', () => {
    expect(exportCSV(['k'], ['en'], { k: { en: 'a\nb' } })).toContain('"a\nb"')
    expect(exportTSV(['k'], ['en'], { k: { en: 'a\nb' } })).toContain('"a\nb"')
  })
})
