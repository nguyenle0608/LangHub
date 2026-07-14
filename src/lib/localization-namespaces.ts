export const ROOT_NAMESPACE_FILENAME = '_root.json'

export type JsonImportStructure = 'monolithic' | 'namespaced'
export type JsonExportStructure = 'monolithic' | 'namespaced'

export type NamespaceGroup = {
  namespace: string
  filename: string
  keys: Record<string, string>
}

export function filenameBase(filename: string): string {
  const lastSegment = filename.split(/[\\/]/).pop() ?? filename
  return lastSegment.replace(/\.[^.]+$/, '')
}

export function sanitizeNamespaceSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function deriveNamespaceFromFilename(filename: string): string {
  return sanitizeNamespaceSegment(filenameBase(filename))
}

export function prefixKeysWithNamespace(
  keys: Record<string, string>,
  namespace: string
): Record<string, string> {
  const cleanNamespace = sanitizeNamespaceSegment(namespace)
  if (!cleanNamespace) return keys

  return Object.fromEntries(
    Object.entries(keys).map(([key, value]) => [`${cleanNamespace}.${key}`, value])
  )
}

export function detectTransformedKeyCollisions(
  entries: Array<{ filename: string; namespace: string; keys: Record<string, string> }>
): string[] {
  const ownerByKey = new Map<string, string>()
  const collisions = new Set<string>()

  for (const entry of entries) {
    const transformed = prefixKeysWithNamespace(entry.keys, entry.namespace)
    for (const key of Object.keys(transformed)) {
      const owner = ownerByKey.get(key)
      if (owner && owner !== entry.filename) collisions.add(key)
      else ownerByKey.set(key, entry.filename)
    }
  }

  return Array.from(collisions).sort()
}

export function splitKeysByNamespace(flat: Record<string, string>): NamespaceGroup[] {
  const groups = new Map<string, Record<string, string>>()

  for (const [key, value] of Object.entries(flat)) {
    const dotIndex = key.indexOf('.')
    const namespace = dotIndex > 0 ? key.slice(0, dotIndex) : '_root'
    const innerKey = dotIndex > 0 ? key.slice(dotIndex + 1) : key

    if (!groups.has(namespace)) groups.set(namespace, {})
    groups.get(namespace)![innerKey] = value
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([namespace, keys]) => ({
      namespace,
      filename: namespace === '_root' ? ROOT_NAMESPACE_FILENAME : `${namespace}.json`,
      keys,
    }))
}
