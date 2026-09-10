import { describe, expect, it } from 'vitest'
import { foldContinuationRows, parseTsv, parseTsvRows, unwrapQuotedCell } from '../delimited'

const TAB = '\t'
const row = (...cells: string[]) => cells.join(TAB)

describe('parseTsvRows', () => {
  it('splits on tabs and newlines', () => {
    expect(parseTsvRows([row('Key', 'en'), row('a.b', 'Hello')].join('\n')))
      .toEqual([['Key', 'en'], ['a.b', 'Hello']])
  })

  // The case that made Papa lose 41 rows of a real export.
  it('treats a quote as an ordinary character', () => {
    const rows = parseTsvRows([
      row('Key', 'en'),
      row('hint', 'choose "Other"'),
      row('after', 'this row must survive'),
    ].join('\n'))

    expect(rows[1]).toEqual(['hint', 'choose "Other"'])
    expect(rows[2]).toEqual(['after', 'this row must survive'])
  })

  // An unterminated opening quote used to swallow every following row.
  it('does not let an unclosed quote consume the rest of the file', () => {
    const rows = parseTsvRows([
      row('Key', 'tr'),
      row('redeem', '"Şu anda kupon kullanılamıyor.'),
      row('after', 'still its own row'),
    ].join('\n'))

    expect(rows).toHaveLength(3)
    expect(rows[2]).toEqual(['after', 'still its own row'])
  })

  it('normalises CRLF', () => {
    expect(parseTsvRows(row('Key', 'en') + '\r\n' + row('a', 'b')))
      .toEqual([['Key', 'en'], ['a', 'b']])
  })

  it('keeps empty cells so columns stay aligned', () => {
    expect(parseTsvRows(row('a', '', 'c'))).toEqual([['a', '', 'c']])
  })
})

describe('foldContinuationRows', () => {
  it('rejoins a row split by a newline inside a cell', () => {
    const folded = foldContinuationRows([
      ['Key', 'en', 'km'],
      ['redeem', 'No redeems now.'],       // split here
      ['Please come back later.', '', 'សូម'],
      ['next', 'Next', 'បន្ទាប់'],
    ], 3)

    expect(folded).toHaveLength(3)
    expect(folded[1]).toEqual(['redeem', 'No redeems now.\nPlease come back later.', '', 'សូម'])
    expect(folded[2]).toEqual(['next', 'Next', 'បន្ទាប់'])
  })

  // A split leaves the first piece short too — that is the signal. Line 501 of
  // the real export had 9 cells and line 502 had 10, summing to the 18 the
  // header declares once the boundary cells are rejoined.
  it('folds a value broken across more than two lines', () => {
    const folded = foldContinuationRows([
      ['Key', 'en', 'km'],
      ['a', 'one'],          // short: the split happened after "one"
      ['two'],               // still short once joined
      ['three', ''],         // completes the row
      ['b', 'other', 'x'],
    ], 3)

    expect(folded[1]).toEqual(['a', 'one\ntwo\nthree', ''])
    expect(folded[2]).toEqual(['b', 'other', 'x'])
  })

  it('leaves well-formed rows untouched', () => {
    const rows = [['Key', 'en'], ['a', 'one'], ['b', 'two']]
    expect(foldContinuationRows(rows, 2)).toEqual(rows)
  })
})

describe('unwrapQuotedCell', () => {
  it('strips quotes that wrap the whole value', () => {
    expect(unwrapQuotedCell('"line one\nline two"')).toBe('line one\nline two')
  })

  it('unescapes doubled quotes inside a wrapped value', () => {
    expect(unwrapQuotedCell('"He said ""hi"""')).toBe('He said "hi"')
  })

  it('leaves a quote that is part of the text', () => {
    expect(unwrapQuotedCell('choose "Other"')).toBe('choose "Other"')
    expect(unwrapQuotedCell('"unclosed')).toBe('"unclosed')
  })
})

describe('parseTsv', () => {
  it('keys rows by header and pads short rows', () => {
    const { headers, rows } = parseTsv([
      row('Key', 'en-US', 'vi-VN'),
      row('a.b', 'Hello'),
    ].join('\n'))

    expect(headers).toEqual(['Key', 'en-US', 'vi-VN'])
    expect(rows[0]).toEqual({ Key: 'a.b', 'en-US': 'Hello', 'vi-VN': '' })
  })

  it('handles all three habits in one file', () => {
    const { rows } = parseTsv([
      row('Key', 'en', 'km'),
      row('bare', 'choose "Other"', 'x'),
      row('split', 'first line'),        // newline inside the en value
      row('second line', 'y'),
      row('wrapped', '"a, b"', 'z'),
    ].join('\n'))

    expect(rows.map((r) => r['Key'])).toEqual(['bare', 'split', 'wrapped'])
    expect(rows[0]!['en']).toBe('choose "Other"')
    expect(rows[1]!['en']).toBe('first line\nsecond line')
    expect(rows[2]!['en']).toBe('a, b')
  })
  it('does not let a newline in the last column swallow the next row', () => {
    const { rows } = parseTsv([
      row('Key', 'en', 'km'),
      row('greeting', 'Hello', 'Welcome to'),  // the km value breaks here...
      ' WeMasterTrade',                        // ...and finishes on its own line
      row('farewell', 'Bye', 'Lia hauy'),
    ].join('\n'))

    expect(rows.map((r) => r['Key'])).toEqual(['greeting', 'farewell'])
    expect(rows[0]!['km']).toBe('Welcome to\n WeMasterTrade')
    expect(rows[1]!['en']).toBe('Bye')
  })
})
