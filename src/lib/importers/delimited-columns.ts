/**
 * Matching the locale columns of a CSV/TSV sheet to the project's languages.
 *
 * A sheet like `Key | en-US | en-CA | vi-VN` is one file holding many languages,
 * so the import expands it into one job per column. Which column feeds which
 * language is the only decision the file cannot make for itself: the header is
 * whatever the person who made the sheet typed.
 *
 * The guess is deliberately conservative — it never assigns two columns to the
 * same language, and it never invents a language the project does not have. The
 * wizard shows every guess and lets the user change or drop any of them.
 */

import { normalizeLocaleCode, parseLocaleCode } from '@/lib/locale-code'

export interface ProjectLocaleRef {
  id: string
  code: string
}

/** Canonical form for comparison: en_us, EN-US and en-US are one code. */
function canonical(code: string): string {
  return normalizeLocaleCode(code.trim()) ?? code.trim().toLowerCase()
}

function baseLanguage(code: string): string {
  return parseLocaleCode(canonical(code))?.language ?? canonical(code).toLowerCase()
}

/**
 * Map each column header to a project locale id, or '' when nothing fits.
 *
 * Exact codes win outright, and only then is a looser reading allowed, so a
 * sheet carrying both `en` and `en-US` cannot have `en-US` swallowed by `en`
 * just because it was listed first. A language is claimed at most once: three
 * English columns against a single `en` locale leaves two of them unassigned
 * for the user to resolve, which is better than silently importing whichever
 * one happened to come last.
 */
export function autoMapColumns(headers: string[], locales: ProjectLocaleRef[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const claimed = new Set<string>()

  const byCode = new Map<string, ProjectLocaleRef>()
  locales.forEach((locale) => byCode.set(canonical(locale.code), locale))

  const unmatched: string[] = []
  headers.forEach((header) => {
    const exact = byCode.get(canonical(header))
    if (exact && !claimed.has(exact.id)) {
      mapping[header] = exact.id
      claimed.add(exact.id)
      return
    }
    unmatched.push(header)
  })

  // Second pass: same language, different region — `en-GB` into a project that
  // only tracks `en`, or `pt` into a project that only has `pt-BR`.
  unmatched.forEach((header) => {
    const language = baseLanguage(header)
    const candidate = locales.find((locale) => baseLanguage(locale.code) === language && !claimed.has(locale.id))
    if (candidate) {
      mapping[header] = candidate.id
      claimed.add(candidate.id)
      return
    }
    mapping[header] = ''
  })

  return mapping
}

/**
 * A column the project has no language for, offered as something to create.
 * Only a well-formed code is worth suggesting — a column headed "Notes" or
 * "Screen" is not a language, and offering to create it would be noise.
 */
export function suggestedLocaleCode(header: string): string | null {
  return normalizeLocaleCode(header.trim())
}
