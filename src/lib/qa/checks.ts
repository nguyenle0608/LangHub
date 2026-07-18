// Automated translation QA — pure functions comparing a target translation
// against its source (base-locale) value. No AI, no side effects.

export type QASeverity = 'error' | 'warning'

export interface QAIssue {
  rule: string
  severity: QASeverity
  message: string
}

// printf / Android / iOS conversions: %s %d %@ %1$s %02d %.2f %ld … (not %%)
const PRINTF_RE = /%(?:\d+\$)?[-+ 0#]*\d*(?:\.\d+)?(?:hh?|ll?|[Lzjt])?([@diouxXeEfFgGaAcspn%])/g
const DOUBLE_BRACE_RE = /\{\{\s*([^{}]+?)\s*\}\}/g
// `*?` (not `+?`) so empty positional braces `{}` / `{ }` — used by
// easy_localization (Flutter), i18next and others — are counted too.
const SINGLE_BRACE_RE = /\{\s*([^{}]*?)\s*\}/g
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g

// Normalizes placeholders so reordering/width tweaks don't false-positive:
// %1$02d → %d, {{ name }} → {{name}}, { name } → {name}.
export function extractPlaceholders(text: string): string[] {
  const tokens: string[] = []

  PRINTF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PRINTF_RE.exec(text)) !== null) {
    if (m[1] === '%') continue // literal %%
    tokens.push(`%${m[1]}`)
  }

  const withoutDouble = text.replace(DOUBLE_BRACE_RE, (_, name: string) => {
    tokens.push(`{{${name.trim()}}}`)
    return ' '
  })

  SINGLE_BRACE_RE.lastIndex = 0
  let s: RegExpExecArray | null
  while ((s = SINGLE_BRACE_RE.exec(withoutDouble)) !== null) {
    tokens.push(`{${(s[1] ?? '').trim()}}`)
  }

  return tokens
}

export function extractTags(text: string): string[] {
  const tokens: string[] = []
  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_RE.exec(text)) !== null) {
    const closing = m[0].startsWith('</')
    tokens.push(`${closing ? '/' : ''}${(m[1] ?? '').toLowerCase()}`)
  }
  return tokens
}

function multisetDiff(source: string[], target: string[]): { missing: string[]; extra: string[] } {
  const count = (arr: string[]) => {
    const map = new Map<string, number>()
    for (const t of arr) map.set(t, (map.get(t) ?? 0) + 1)
    return map
  }
  const cs = count(source)
  const ct = count(target)
  const missing: string[] = []
  const extra: string[] = []
  cs.forEach((n, t) => { for (let i = 0; i < n - (ct.get(t) ?? 0); i++) missing.push(t) })
  ct.forEach((n, t) => { for (let i = 0; i < n - (cs.get(t) ?? 0); i++) extra.push(t) })
  return { missing, extra }
}

const leading = (s: string) => /^\s*/.exec(s)?.[0] ?? ''
const trailing = (s: string) => /\s*$/.exec(s)?.[0] ?? ''

// Returns QA issues for a target translation given its source value.
// Empty target is skipped (that is a status concern, not a QA one).
export function checkTranslation(source: string, target: string): QAIssue[] {
  const issues: QAIssue[] = []
  if (!source || !target) return issues

  const ph = multisetDiff(extractPlaceholders(source), extractPlaceholders(target))
  if (ph.missing.length) {
    issues.push({
      rule: 'placeholder-missing',
      severity: 'error',
      message: `Missing placeholder${ph.missing.length > 1 ? 's' : ''}: ${ph.missing.join(', ')}`,
    })
  }
  if (ph.extra.length) {
    issues.push({
      rule: 'placeholder-extra',
      severity: 'error',
      message: `Unexpected placeholder${ph.extra.length > 1 ? 's' : ''}: ${ph.extra.join(', ')}`,
    })
  }

  const tags = multisetDiff(extractTags(source), extractTags(target))
  if (tags.missing.length || tags.extra.length) {
    issues.push({
      rule: 'html-mismatch',
      severity: 'warning',
      message: 'HTML tags differ from the source text',
    })
  }

  if (leading(source) !== leading(target)) {
    issues.push({ rule: 'leading-whitespace', severity: 'warning', message: 'Leading whitespace differs from source' })
  }
  if (trailing(source) !== trailing(target)) {
    issues.push({ rule: 'trailing-whitespace', severity: 'warning', message: 'Trailing whitespace differs from source' })
  }

  return issues
}
