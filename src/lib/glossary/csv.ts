import Papa from 'papaparse'

// Bulk glossary import format (distinct from the translation-file CSV format
// in src/lib/parsers/csv.ts): one row per term pair.
//
//   source_locale,target_locale,source_term,target_term,case_sensitive,whole_word
//   en,vi,Sign in,Đăng nhập,false,true

export interface GlossaryCSVRow {
  sourceLocale: string
  targetLocale: string
  sourceTerm: string
  targetTerm: string
  caseSensitive: boolean
  wholeWord: boolean
}

export interface GlossaryCSVParseResult {
  rows: GlossaryCSVRow[]
  // One entry per rejected row/parse problem, e.g. "Row 3: source_term is required".
  errors: string[]
}

const REQUIRED_HEADERS = ['source_locale', 'target_locale', 'source_term', 'target_term']
// Mirrors the DB check constraint on glossary_terms.source_locale/target_locale.
const LOCALE_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/
const MAX_TERM_LENGTH = 500

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === '') return fallback
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return fallback
}

export function parseGlossaryCSV(content: string): GlossaryCSVParseResult {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  })

  // FieldMismatch just means a row has fewer/more commas than the header —
  // routine when the optional trailing columns (case_sensitive, whole_word)
  // are omitted entirely rather than left blank. Papa Parse still returns the
  // row's data (missing cells as undefined), so only abort the whole file for
  // genuinely unparseable input (e.g. mismatched quotes).
  const fatalErrors = result.errors.filter((e) => e.type !== 'FieldMismatch')
  if (fatalErrors.length > 0) {
    return { rows: [], errors: fatalErrors.map((e) => `Row ${e.row ?? '?'}: ${e.message}`) }
  }

  const headers = (result.meta.fields ?? []).map((h) => h.trim().toLowerCase())
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(', ')}`] }
  }

  const rows: GlossaryCSVRow[] = []
  const errors: string[] = []

  result.data.forEach((raw, index) => {
    const rowNum = index + 2 // header is row 1; data rows are 1-indexed after it
    const record: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw)) record[key.trim().toLowerCase()] = (value ?? '').trim()

    const sourceLocale = record.source_locale?.toLowerCase()
    const targetLocale = record.target_locale?.toLowerCase()
    const sourceTerm = record.source_term
    const targetTerm = record.target_term

    if (!sourceLocale || !targetLocale || !sourceTerm || !targetTerm) {
      errors.push(`Row ${rowNum}: source_locale, target_locale, source_term, and target_term are all required`)
      return
    }
    if (!LOCALE_RE.test(sourceLocale)) { errors.push(`Row ${rowNum}: invalid source_locale "${sourceLocale}"`); return }
    if (!LOCALE_RE.test(targetLocale)) { errors.push(`Row ${rowNum}: invalid target_locale "${targetLocale}"`); return }
    if (sourceLocale === targetLocale) { errors.push(`Row ${rowNum}: source_locale and target_locale must differ`); return }
    if (sourceTerm.length > MAX_TERM_LENGTH) { errors.push(`Row ${rowNum}: source_term exceeds ${MAX_TERM_LENGTH} characters`); return }
    if (targetTerm.length > MAX_TERM_LENGTH) { errors.push(`Row ${rowNum}: target_term exceeds ${MAX_TERM_LENGTH} characters`); return }

    rows.push({
      sourceLocale,
      targetLocale,
      sourceTerm,
      targetTerm,
      caseSensitive: parseBoolean(record.case_sensitive, false),
      wholeWord: parseBoolean(record.whole_word, true),
    })
  })

  return { rows, errors }
}
