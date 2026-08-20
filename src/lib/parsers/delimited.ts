/**
 * A reader for tab-separated exports.
 *
 * Papa is kept for CSV, where RFC 4180 quoting is what spreadsheets emit. Real
 * TSV exports are not RFC 4180, and this one contains three habits at once:
 *
 *   choose "Other"                     a quote that is ordinary text
 *   "Şu anda kupon kullanılamıyor.     a quote opening a value that runs on
 *   ...soon.<NEWLINE>សូមត្រលប់...      a newline inside a value, not quoted at all
 *
 * Quote-aware parsing handles the second and is defeated by the other two: the
 * bare quote desynchronises it (41 rows lost on this file) and an unterminated
 * opening quote swallows every row after it. Since an unquoted newline is
 * indistinguishable from the end of a row, no quoting rule can be complete
 * here anyway.
 *
 * So quotes are never structural: a row is a line, a cell is a tab-separated
 * span, and a quote is a character. What recovers the split values instead is
 * the column count, which the header fixes — a row with too few cells can only
 * be a continuation of the one above. Quotes wrapping a whole value are
 * stripped afterwards, once the value is whole again.
 */

const TAB = '\t'

/** Rows of raw cells, one row per line. Handles CRLF and a trailing newline. */
export function parseTsvRows(input: string): string[][] {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.split(TAB))
}

/**
 * Rejoin rows that a bare newline split apart.
 *
 * The column count is known from the header, so a row with too few cells can
 * only be the continuation of the one before it. The newline goes back where
 * it was, inside the cell it belongs to.
 */
export function foldContinuationRows(rows: string[][], width: number): string[][] {
  if (width <= 1) return rows
  const folded: string[][] = []

  for (const row of rows) {
    const previous = folded[folded.length - 1]
    if (previous && previous.length < width) {
      previous[previous.length - 1] += '\n' + (row[0] ?? '')
      previous.push(...row.slice(1))
      continue
    }
    folded.push([...row])
  }

  return folded
}

/**
 * Undo spreadsheet quoting on a value that is wrapped in quotes end to end.
 * A quote anywhere else is left alone: it is text.
 */
export function unwrapQuotedCell(cell: string): string {
  if (cell.length >= 2 && cell.startsWith('"') && cell.endsWith('"')) {
    return cell.slice(1, -1).replace(/""/g, '"')
  }
  return cell
}

/** Rows as objects keyed by the header row, padded so every column is present. */
export function parseTsv(input: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = parseTsvRows(input).filter((row) => row.some((cell) => cell.trim() !== ''))
  const headers = (lines[0] ?? []).map(unwrapQuotedCell)
  const folded = foldContinuationRows(lines, headers.length)

  const rows = folded.slice(1).map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, i) => { record[header] = unwrapQuotedCell(cells[i] ?? '') })
    return record
  })

  return { headers, rows }
}
