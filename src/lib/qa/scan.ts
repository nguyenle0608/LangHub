import { checkTranslation, type QAIssue } from './checks'

export interface ScanKey {
  id: string
  key: string
}
export interface ScanTranslation {
  key_id: string | null
  locale_id: string | null
  value: string | null
}
export interface ScanLocale {
  id: string
  code: string
  name: string
  is_base: boolean | null
}

export interface QARow {
  keyId: string
  key: string
  localeId: string
  localeCode: string
  localeName: string
  value: string
  issues: QAIssue[]
}

export interface QAReport {
  /** Number of non-empty (key, target-locale) pairs actually checked. */
  scanned: number
  errorCount: number
  warningCount: number
  byRule: { rule: string; count: number }[]
  rows: QARow[]
}

// Runs QA across every target-locale translation, comparing each against its
// base-locale source. Pure: takes rows, returns an aggregated report.
export function scanProjectQA(
  keys: ScanKey[],
  translations: ScanTranslation[],
  locales: ScanLocale[]
): QAReport {
  const baseLocale = locales.find((l) => l.is_base)
  const keyName = new Map(keys.map((k) => [k.id, k.key]))
  const localeById = new Map(locales.map((l) => [l.id, l]))

  const baseValue = new Map<string, string>()
  if (baseLocale) {
    for (const t of translations) {
      if (t.locale_id === baseLocale.id && t.key_id) baseValue.set(t.key_id, t.value ?? '')
    }
  }

  const rows: QARow[] = []
  const byRule = new Map<string, number>()
  let errorCount = 0
  let warningCount = 0
  let scanned = 0

  for (const t of translations) {
    if (!t.key_id || !t.locale_id) continue
    if (baseLocale && t.locale_id === baseLocale.id) continue
    const source = baseValue.get(t.key_id) ?? ''
    const value = t.value ?? ''
    if (!source || !value) continue

    scanned++
    const issues = checkTranslation(source, value)
    if (issues.length === 0) continue

    const loc = localeById.get(t.locale_id)
    rows.push({
      keyId: t.key_id,
      key: keyName.get(t.key_id) ?? '',
      localeId: t.locale_id,
      localeCode: loc?.code ?? '',
      localeName: loc?.name ?? '',
      value,
      issues,
    })
    for (const issue of issues) {
      byRule.set(issue.rule, (byRule.get(issue.rule) ?? 0) + 1)
      if (issue.severity === 'error') errorCount++
      else warningCount++
    }
  }

  rows.sort((a, b) => a.key.localeCompare(b.key) || a.localeCode.localeCompare(b.localeCode))

  return {
    scanned,
    errorCount,
    warningCount,
    byRule: Array.from(byRule.entries(), ([rule, count]) => ({ rule, count })).sort((a, b) => b.count - a.count),
    rows,
  }
}
