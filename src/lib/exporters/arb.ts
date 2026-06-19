export function exportARB(
  keys: Record<string, string>,
  locale: string,
  descriptions?: Record<string, string>
): string {
  const obj: Record<string, unknown> = { '@@locale': locale }
  for (const [k, v] of Object.entries(keys)) {
    obj[k] = v
    if (descriptions?.[k]) {
      obj[`@${k}`] = { description: descriptions[k] }
    }
  }
  return JSON.stringify(obj, null, 2)
}
