import yaml from 'js-yaml'
import type { ParseResult } from './index'
import { flattenObject } from './index'

export function parseYAML(content: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []

  let parsed: unknown
  try {
    parsed = yaml.load(content)
  } catch (e) {
    return { keys: {}, errors: [`Invalid YAML: ${String(e)}`], warnings }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { keys: {}, errors: ['Root must be a YAML mapping'], warnings }
  }

  const keys = flattenObject(parsed as Record<string, unknown>)
  return { keys, errors, warnings }
}
