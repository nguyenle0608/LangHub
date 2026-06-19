export type ParseResult = {
  keys: Record<string, string>
  locale?: string
  errors: string[]
  warnings: string[]
}

export function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flattenObject(v as Record<string, unknown>, key))
    } else if (typeof v === 'string') {
      result[key] = v
    } else if (v !== null && v !== undefined) {
      result[key] = String(v)
    }
  }
  return result
}
