import Papa from 'papaparse'
import type { ParseResult } from './index'
import { parseTsv } from './delimited'

/**
 * Delimited translation tables: one key column followed by one column per
 * locale. Returns a ParseResult per locale column, so a sheet holding a dozen
 * languages is imported in one pass rather than once per language.
 *
 * CSV and TSV are separate formats chosen by the caller, not sniffed from the
 * content: the file's extension already says which one it is, and guessing
 * gets it wrong on a comma-heavy TSV or a single-column CSV.
 */

function toResults(headers: string[], rows: Record<string, string>[]): ParseResult[] {
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
  // but refusing anything else turns a header nobody thought about — real
  // exports head it "Lang", "String", "ID" — into a failed import.
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

/** Comma-separated. Papa handles RFC 4180 quoting, which is what spreadsheets emit. */
export function parseCSV(content: string): ParseResult[] {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    delimiter: ',',
  })
  return toResults(parsed.meta.fields ?? [], parsed.data)
}

/** Tab-separated, through the reader in ./delimited — see the note there on why. */
export function parseTSV(content: string): ParseResult[] {
  const { headers, rows } = parseTsv(content)
  return toResults(headers, rows)
}
