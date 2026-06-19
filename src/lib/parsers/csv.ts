import Papa from 'papaparse'
import type { ParseResult } from './index'

// Returns one ParseResult per locale column (excluding 'key' column)
export function parseCSV(content: string): ParseResult[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  })

  if (result.errors.length > 0) {
    return [{
      keys: {},
      errors: result.errors.map((e) => `Row ${e.row ?? '?'}: ${e.message}`),
      warnings: [],
    }]
  }

  const headers = result.meta.fields ?? []
  const keyCol = headers[0]
  if (!keyCol || keyCol.toLowerCase() !== 'key') {
    return [{ keys: {}, errors: ['First column must be "key"'], warnings: [] }]
  }

  const localeCols = headers.slice(1)
  if (localeCols.length === 0) {
    return [{ keys: {}, errors: ['No locale columns found after "key" column'], warnings: [] }]
  }

  return localeCols.map((localeCode) => {
    const keys: Record<string, string> = {}
    const warnings: string[] = []

    for (const row of result.data) {
      const key = row[keyCol]?.trim()
      if (!key) { warnings.push('Skipped row with empty key'); continue }
      const value = row[localeCode] ?? ''
      if (value) keys[key] = value
    }

    return { keys, locale: localeCode, errors: [], warnings }
  })
}
