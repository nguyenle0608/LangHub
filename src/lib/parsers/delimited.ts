/**
 * A reader for tab-separated exports.
 *
 * Papa is kept for CSV, where RFC 4180 quoting is what spreadsheets emit. Real
 * TSV exports are not RFC 4180, and one real file contained three habits at
 * once:
 *
 *   choose "Other"                     a quote that is ordinary text
 *   "Şu anda kupon kullanılamıyor.     a quote opening a value that never closes
 *   ...soon.<NEWLINE>សូមត្រលប់...      a newline inside a value, not quoted at all
 *
 * Fully quote-aware parsing handles none of them well: the bare quote
 * desynchronises it (41 of 690 rows lost), and the unterminated quote swallows
 * every row after it while hunting for a close.
 *
 * Two rules cover all of it without either failure mode:
 *
 *  1. A quote is structural only when it opens a cell *and closes on the same
 *     line*. That is enough to carry a tab inside a value — which is what our
 *     own export needs — and it cannot run away, because the search never
 *     leaves the line.
 *  2. A value broken over several lines is put back by counting columns. The
 *     header fixes the width, so a row with too few cells can only continue the
 *     one above. This needs no quoting at all, which is why it also recovers
 *     values that were never quoted.
 */

const TAB = '\t'
const QUOTE = '"'

/**
 * Split one line into cells, honouring a quoted cell that closes on this line.
 * An unclosed quote is treated as text: fold + unwrap deal with it later.
 */
function splitLine(line: string): string[] {
  if (!line.includes(QUOTE)) return line.split(TAB)

  const cells: string[] = []
  let cell = ''
  let index = 0

  while (index < line.length) {
    if (line[index] === QUOTE && cell === '') {
      const close = findClosingQuote(line, index)
      if (close !== -1) {
        cell = line.slice(index + 1, close).replace(/""/g, QUOTE)
        index = close + 1
        // Anything trailing before the delimiter is malformed; keep it.
        while (index < line.length && line[index] !== TAB) { cell += line[index]; index++ }
        continue
      }
    }
    if (line[index] === TAB) { cells.push(cell); cell = ''; index++; continue }
    cell += line[index]
    index++
  }
  cells.push(cell)
  return cells
}

/** Index of the quote that ends a cell opened at `start`, or -1 on this line. */
function findClosingQuote(line: string, start: number): number {
  let i = start + 1
  while (i < line.length) {
    if (line[i] === QUOTE) {
      if (line[i + 1] === QUOTE) { i += 2; continue } // escaped
      // A closing quote is followed by a delimiter or the end of the line.
      if (i + 1 === line.length || line[i + 1] === TAB) return i
    }
    i++
  }
  return -1
}

/** Rows of raw cells, one row per line. Handles CRLF and a trailing newline. */
export function parseTsvRows(input: string): string[][] {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(splitLine)
}

/**
 * True when a cell opens a quote it never closes, which means the value
 * continues on the next line. Doubled quotes are escapes and cancel out, so a
 * sentence like: choose "Other" reads as closed, which it is.
 */
function endsMidQuote(cell: string): boolean {
  const quotes = cell.replace(/""/g, '').split('"').length - 1
  return quotes % 2 === 1
}

/**
 * Rejoin rows that a newline split apart.
 *
 * The column count is known from the header, so a row with too few cells can
 * only be the continuation of the one above. The newline goes back where it
 * was, inside the cell it belongs to.
 */
export function foldContinuationRows(rows: string[][], width: number): string[][] {
  if (width <= 1) return rows
  const folded: string[][] = []

  for (const row of rows) {
    const previous = folded[folded.length - 1]
    // Too few cells means the row was cut short. Enough cells but a cell still
    // inside a quote means the last value was: a multi-line value in the final
    // column reaches full width before it is actually finished.
    const incomplete = previous
      && (previous.length < width || endsMidQuote(previous[previous.length - 1] ?? ''))
    if (incomplete) {
      previous[previous.length - 1] += '\n' + (row[0] ?? '')
      previous.push(...row.slice(1))
      continue
    }
    folded.push([...row])
  }

  return folded
}

/**
 * Undo quoting on a value wrapped end to end — the state a multi-line value is
 * in once folding has made it whole again. A quote anywhere else is text.
 */
export function unwrapQuotedCell(cell: string): string {
  if (cell.length >= 2 && cell.startsWith(QUOTE) && cell.endsWith(QUOTE)) {
    return cell.slice(1, -1).replace(/""/g, QUOTE)
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
