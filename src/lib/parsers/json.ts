import type { ParseResult } from './index'
import { flattenObject } from './index'

export function parseJSON(content: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    return { keys: {}, errors: [`Invalid JSON: ${String(e)}`], warnings }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { keys: {}, errors: ['Root must be a JSON object'], warnings }
  }

  const obj = parsed as Record<string, unknown>
  const keys = flattenObject(obj)

  const skipped = Object.entries(obj).filter(([, v]) => typeof v !== 'string' && typeof v !== 'object').length
  if (skipped > 0) warnings.push(`Skipped ${skipped} non-string/non-object values`)

  return { keys, errors, warnings }
}
