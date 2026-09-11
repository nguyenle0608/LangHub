import type { Report, Overwrite } from './sync.js'

const PREVIEW = 10

/**
 * How to label the two values. The side being destroyed is always printed
 * first, so the eye lands on what is at stake before what replaces it.
 */
export interface Sides { from: string; to: string }

export const PULL_SIDES: Sides = { from: 'here:   ', to: 'LangHub:' }
export const PUSH_SIDES: Sides = { from: 'LangHub:', to: 'here:   ' }

/** One line per locale: what would change, in the order of how much it costs. */
export function formatPlan(label: string, report: Report): string {
  const parts: string[] = []
  if (report.added.length) parts.push(`${report.added.length} added`)
  if (report.overwrites.length) parts.push(`${report.overwrites.length} overwritten`)
  if (report.notInLangHub.length) parts.push(`${report.notInLangHub.length} kept`)
  return `  ${label.padEnd(22)} ${parts.join(', ') || 'no change'}`
}

/**
 * The keys that would lose their current value, with both values shown.
 *
 * A count cannot be judged — "20 overwritten" is either a routine sync or a
 * morning of someone's work, and the two look identical until the values are
 * on screen. Showing them is what makes the confirmation a decision rather
 * than a keystroke.
 */
export function formatOverwrites(
  entries: Array<{ label: string; overwrites: Overwrite[] }>,
  sides: Sides
): string {
  const lines: string[] = []
  for (const { label, overwrites } of entries) {
    if (overwrites.length === 0) continue
    lines.push(`\n${label} — ${overwrites.length} value${overwrites.length === 1 ? '' : 's'} would be replaced:`)
    for (const { key, from, to } of overwrites.slice(0, PREVIEW)) {
      lines.push(`  ${key}`)
      lines.push(`    ${sides.from} ${truncate(from)}`)
      lines.push(`    ${sides.to} ${truncate(to)}`)
    }
    if (overwrites.length > PREVIEW) lines.push(`  ... and ${overwrites.length - PREVIEW} more`)
  }
  return lines.join('\n')
}

/**
 * Keys this repo has and LangHub does not. Not a conflict — nothing is lost,
 * they are kept — but the only signal that something has not been uploaded.
 */
export function formatNotInLangHub(entries: Array<{ label: string; keys: string[] }>): string {
  const lines: string[] = []
  for (const { label, keys } of entries) {
    if (keys.length === 0) continue
    lines.push(`\n${label} — ${keys.length} key${keys.length === 1 ? '' : 's'} here but not in LangHub (kept, upload them):`)
    for (const key of keys.slice(0, PREVIEW)) lines.push(`  ${key}`)
    if (keys.length > PREVIEW) lines.push(`  ... and ${keys.length - PREVIEW} more`)
  }
  return lines.join('\n')
}

function truncate(value: string, max = 90): string {
  const flat = value.replace(/\n/g, '\\n')
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}
