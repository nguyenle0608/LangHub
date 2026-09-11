import { flatten, nest, type Flat } from './keys.js'

/**
 * Merging keys. Values are opaque.
 *
 * The CLI carries strings from LangHub into a repo and guarantees which keys
 * are present. What a value means — its placeholder syntax, its plural rules,
 * whether an empty one falls back — belongs to the i18n library reading the
 * file, and that is the project's business, not this tool's. Nothing here
 * inspects the inside of a string.
 *
 * One consequence worth stating, because it looks like a rule and is not: a key
 * LangHub has no approved translation for is simply not written. That is not a
 * policy about fallback behaviour, it is what "sync the strings that exist"
 * means — there is no string to carry. It happens to be exactly what libraries
 * like easy_localization need in order to fall back, at no cost to us.
 */

/**
 * A value that would be destroyed, and the one that would replace it.
 *
 * Named for the roles rather than for the sides, because both directions use
 * this: pulling destroys what is in the file, pushing destroys what is in
 * LangHub. Naming the fields `local` and `hub` meant one of the two directions
 * always read backwards.
 */
export interface Overwrite {
  key: string
  /** What is there now, and would be gone. */
  from: string
  /** What would be written in its place. */
  to: string
}

export interface Report {
  /** Keys LangHub has that the file did not. Nothing is lost writing these. */
  added: string[]
  /**
   * Keys whose local value differs and would be replaced.
   *
   * Separate from `added` because these are the only writes that destroy
   * something. Whether the local value was a stale copy from an earlier pull or
   * an edit someone made this morning is not knowable from here — which is
   * exactly why the caller is shown them rather than told a number.
   */
  overwrites: Overwrite[]
  /** In the file already, unknown to LangHub. Kept — someone has to upload them. */
  notInLangHub: string[]
}

export function emptyReport(): Report {
  return { added: [], overwrites: [], notInLangHub: [] }
}

export function hasChanges(report: Report): boolean {
  return report.added.length > 0 || report.overwrites.length > 0
}

/**
 * LangHub's keys for this locale, plus the ones the file already had.
 *
 * Nothing is ever removed. A key the repo has and LangHub does not is far more
 * often "not uploaded yet" than "deleted", and the two are indistinguishable
 * from here — so the sync reports it and leaves it alone. Removing keys is a
 * decision made by whoever can tell the difference, in the project's own
 * tooling, where the framework's rules already live.
 */
export function merge(hub: Flat, local: Flat, report: Report): Flat {
  const merged: Flat = { ...local }

  for (const [key, value] of Object.entries(hub)) {
    if (!(key in local)) report.added.push(key)
    else if (local[key] !== value) report.overwrites.push({ key, from: local[key]!, to: value })
    merged[key] = value
  }

  for (const key of Object.keys(local)) {
    if (!(key in hub)) report.notInLangHub.push(key)
  }

  return merged
}

export function parseFile(text: string): Flat {
  return flatten(JSON.parse(text) as Record<string, never>)
}

export function serialize(flat: Flat): string {
  return `${JSON.stringify(nest(flat), null, 2)}\n`
}

/**
 * The reverse direction: what this repo would change in LangHub.
 *
 * Deliberately the same shape as `merge`, read the other way round — `added`
 * is what LangHub would gain, `overwrites` is what it would lose. Keeping one
 * vocabulary means the plan, the review, and the confirmation are the same
 * code in both directions, and a reader only has to learn them once.
 *
 * `notInLangHub` has no counterpart here on purpose. A key LangHub has and the
 * repo does not is not something a push should act on: an import touches only
 * the keys it names, and treating absence as deletion would let one stale
 * checkout wipe work nobody involved in this push knew about.
 */
export function diffForPush(local: Flat, hub: Flat, report: Report): Flat {
  const outgoing: Flat = {}
  for (const [key, value] of Object.entries(local)) {
    const existing = hub[key]
    if (existing === undefined) {
      report.added.push(key)
      outgoing[key] = value
    } else if (existing !== value) {
      report.overwrites.push({ key, from: existing, to: value })
      outgoing[key] = value
    }
  }
  return outgoing
}
