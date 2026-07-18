import type { ParseResult } from './index'

function unescapeXmlEntities(value: string): string {
  // &amp; must be decoded last so "&amp;lt;" round-trips to "&lt;", not "<".
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

function unescapeAndroidValue(raw: string): string {
  const withEntities = unescapeXmlEntities(raw)
  return withEntities.replace(/\\(.)/g, (_, char: string) => {
    switch (char) {
      case 'n': return '\n'
      case 't': return '\t'
      case 'r': return '\r'
      case '"': return '"'
      case "'": return "'"
      case '\\': return '\\'
      case '@': return '@'
      case '?': return '?'
      default: return char
    }
  })
}

// Matches <string name="key">value</string> and self-closing <string name="key"/>,
// with single- or double-quoted names. <string-array> and <plurals> are not
// captured (they are reported as warnings).
const STRING_RE =
  /<string\b[^>]*\bname\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*?(?:\/>|>([\s\S]*?)<\/string>)/g

export function parseAndroidXML(content: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const keys: Record<string, string> = {}

  if (!/<resources[\s>]/.test(content)) {
    return { keys: {}, errors: ['Invalid Android resources: missing <resources> root'], warnings }
  }

  let match: RegExpExecArray | null
  STRING_RE.lastIndex = 0
  while ((match = STRING_RE.exec(content)) !== null) {
    const name = match[1] ?? match[2]
    if (!name) continue
    const body = match[3] ?? ''
    keys[name] = unescapeAndroidValue(body)
  }

  if (/<plurals\b/.test(content)) {
    warnings.push('<plurals> elements are not supported and were skipped')
  }
  if (/<string-array\b/.test(content)) {
    warnings.push('<string-array> elements are not supported and were skipped')
  }
  if (Object.keys(keys).length === 0) {
    warnings.push('No <string> entries found')
  }

  return { keys, errors, warnings }
}
