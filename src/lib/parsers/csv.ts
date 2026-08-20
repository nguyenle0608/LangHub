import Papa from 'papaparse'
import type { ParseResult } from './index'
import { parseTsv } from './delimited'

/**
 * Delimited translation tables: one key column followed by one column per
 * locale. Returns a ParseResult per locale column, so a sheet holding a dozen
 * languages can be imported in one pass rather than once per language.
 */

/** Papa auto-detects the delimiter; this only decides how quotes are treated. */
function isTabDelimited(content: string): boolean {
  const newline = content.indexOf('\n')
  const firstLine = newline === -1 ? content : content.slice(0, newline)
  return firstLine.includes('\t')
}

export function parseCSV(content: string): ParseResult[] {
  // Tab files go through the reader in ./delimited, which quotes a field only
  // when it opens with a quote. Papa cannot express that and real exports need
  // it: they contain both bare quotes in prose and genuinely quoted multi-line
  // values. Comma files keep Papa, where RFC 4180 quoting is what tools emit.
  const { headers, rows } = isTabDelimited(content)
    ? parseTsv(content)
    : (() => {
        const parsed = Papa.parse<Record<string, string>>(content, {
          header: true,
          skipEmptyLines: true,
        })
        return { headers: parsed.meta.fields ?? [], rows: parsed.data }
      })()

  const keyCol = headers[0]
  if (!keyCol) {
    return [{ keys: {}, errors: ['No columns found — is the file empty?'], warnings: [] }]
  }

  const localeCols = headers.slice(1).filter((header) => header.trim() !== '')
  if (localeCols.length === 0) {
    return [{ keys: {}, errors: [`No locale columns found after "${keyCol}"`], warnings: [] }]
  }

  const sharedWarnings: string[] = []
  // The first column is the key column by position. "Key" is the convention,
  // but refusing anything else turns a header nobody thought about into a
  // failed import, so say so and carry on.
  if (keyCol.trim().toLowerCase() !== 'key') {
    sharedWarnings.push(`Using "${keyCol}" as the key column — name it "Key" to be explicit`)
  }

  return localeCols.map((localeCode) => {
    const keys: Record<string, string> = {}
    const warnings = [...sharedWarnings]
    let skippedEmptyKeys = 0

    for (const row of rows) {
      const key = row[keyCol]?.trim()
      if (!key) { skippedEmptyKeys++; continue }
      const value = row[localeCode] ?? ''
      if (value) keys[key] = value
    }
    if (skippedEmptyKeys > 0) {
      warnings.push(`Skipped ${skippedEmptyKeys} row${skippedEmptyKeys === 1 ? '' : 's'} with an empty key`)
    }

    return { keys, locale: localeCode, errors: [], warnings }
  })
}
