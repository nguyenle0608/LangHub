import type { QAIssue } from '@/lib/qa/checks'

export interface GlossaryMatchTerm {
  id: string
  sourceTerm: string
  targetTerm: string
  caseSensitive: boolean
  wholeWord: boolean
  description?: string | null
}

export function normalizeAssistanceText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function isWordCharacter(value: string): boolean {
  return value === '_' || /[0-9]/.test(value) || value.toLocaleLowerCase() !== value.toLocaleUpperCase()
}

function termOccurs(text: string, term: string, caseSensitive: boolean, wholeWord: boolean): boolean {
  const haystack = caseSensitive ? text : text.toLocaleLowerCase()
  const needle = caseSensitive ? term : term.toLocaleLowerCase()
  if (!needle) return false

  let offset = 0
  while (offset <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, offset)
    if (index < 0) return false
    if (!wholeWord) return true
    const before = index > 0 ? haystack[index - 1] ?? '' : ''
    const after = index + needle.length < haystack.length ? haystack[index + needle.length] ?? '' : ''
    if ((!before || !isWordCharacter(before)) && (!after || !isWordCharacter(after))) return true
    offset = index + Math.max(needle.length, 1)
  }
  return false
}

export function findApplicableGlossaryTerms(source: string, terms: GlossaryMatchTerm[]): GlossaryMatchTerm[] {
  return terms.filter((term) => termOccurs(source, term.sourceTerm, term.caseSensitive, term.wholeWord))
}

export function checkGlossaryConsistency(
  source: string,
  target: string,
  terms: GlossaryMatchTerm[]
): QAIssue[] {
  if (!source || !target) return []
  return findApplicableGlossaryTerms(source, terms)
    .filter((term) => !termOccurs(target, term.targetTerm, term.caseSensitive, term.wholeWord))
    .map((term) => ({
      rule: `glossary-missing:${term.id}`,
      severity: 'warning' as const,
      message: `Use glossary term “${term.targetTerm}” for “${term.sourceTerm}”`,
    }))
}
