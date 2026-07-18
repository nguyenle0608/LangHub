import type { ParseResult } from './index'

function unescapeIOS(raw: string): string {
  return raw.replace(/\\(.)/g, (_, char: string) => {
    switch (char) {
      case 'n': return '\n'
      case 't': return '\t'
      case 'r': return '\r'
      case '"': return '"'
      case '\\': return '\\'
      default: return char
    }
  })
}

// "key" = "value";  — quotes inside are backslash-escaped.
const PAIR_RE = /"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g

export function parseIOSStrings(content: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const keys: Record<string, string> = {}

  // Strip block comments; line comments and blank lines simply won't match PAIR_RE.
  const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '')

  let match: RegExpExecArray | null
  PAIR_RE.lastIndex = 0
  while ((match = PAIR_RE.exec(withoutComments)) !== null) {
    const key = unescapeIOS(match[1] ?? '')
    const value = unescapeIOS(match[2] ?? '')
    if (key) keys[key] = value
  }

  if (Object.keys(keys).length === 0) {
    warnings.push('No "key" = "value"; entries found')
  }

  return { keys, errors, warnings }
}
