/**
 * Translation keys as a flat space.
 *
 * Every comparison here — what is missing, what drifted, what a locale carries
 * that the base does not — is only meaningful on flat dot paths. Merging two
 * nested trees instead invites a collision the merge cannot represent: one side
 * holding `a.b` as a string while the other holds `a.b.c` as an object. Flatten,
 * decide, and nest once at the end.
 */

export type Flat = Record<string, string>
export type Nested = { [key: string]: string | Nested }

export function flatten(node: Nested, prefix = ''): Flat {
  const out: Flat = {}
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') Object.assign(out, flatten(value, path))
    else out[path] = value
  }
  return out
}

export class KeyCollisionError extends Error {
  constructor(path: string, segment: string) {
    super(`"${path}" needs "${segment}" to be an object, but it already holds a string`)
    this.name = 'KeyCollisionError'
  }
}

/**
 * Keys are sorted on the way out. Not cosmetic: an unsorted rewrite reorders
 * hundreds of lines and buries the handful that changed, and reading that diff
 * is the only review a sync gets.
 */
export function nest(flat: Flat): Nested {
  const root: Nested = {}
  for (const path of Object.keys(flat).sort()) {
    const parts = path.split('.')
    let cursor = root
    for (const part of parts.slice(0, -1)) {
      const existing = cursor[part]
      if (typeof existing === 'string') throw new KeyCollisionError(path, part)
      cursor = (existing ?? (cursor[part] = {})) as Nested
    }
    cursor[parts[parts.length - 1]!] = flat[path]!
  }
  return root
}
