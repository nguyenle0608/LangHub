import type { ParseResult } from './index'

export function parseARB(content: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    return { keys: {}, errors: [`Invalid ARB (JSON parse failed): ${String(e)}`], warnings }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { keys: {}, errors: ['Root must be a JSON object'], warnings }
  }

  const obj = parsed as Record<string, unknown>
  const keys: Record<string, string> = {}
  let locale: string | undefined

  for (const [k, v] of Object.entries(obj)) {
    if (k === '@@locale') {
      locale = String(v)
      continue
    }
    // Skip @-prefixed metadata keys (e.g. @myKey, @@last_modified)
    if (k.startsWith('@')) continue

    if (typeof v === 'string') {
      keys[k] = v
    } else {
      warnings.push(`Key "${k}" has non-string value, skipped`)
    }
  }

  return { keys, locale, errors, warnings }
}
