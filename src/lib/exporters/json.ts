// Rebuild dot.notation keys into nested object, then JSON.stringify
export function buildNested(flat: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [dotKey, value] of Object.entries(flat)) {
    const parts = dotKey.split('.')
    let cursor = result
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!
      if (typeof cursor[part] !== 'object' || cursor[part] === null) {
        cursor[part] = {}
      }
      cursor = cursor[part] as Record<string, unknown>
    }
    const last = parts[parts.length - 1]!
    cursor[last] = value
  }
  return result
}

export function exportJSON(keys: Record<string, string>, nested = true): string {
  const obj = nested ? buildNested(keys) : keys
  return JSON.stringify(obj, null, 2)
}
