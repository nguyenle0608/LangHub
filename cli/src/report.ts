import type { Report, Overwrite } from './sync.js'

/**
 * How many entries a list shows before it summarises the rest.
 *
 * Ten is enough to recognise what a category contains — the shape of the keys,
 * whether it is one feature or scattered — without a plan for fifteen locales
 * scrolling a screenful per category. `--verbose` lifts it for the times the
 * answer is in the part that got cut.
 */
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

export interface LocaleReport {
  label: string
  report: Report
}

/**
 * The whole of what a run would do, one locale at a time.
 *
 * A count answers "is there anything to commit"; it does not answer "is this
 * the change I meant to make". Twelve added keys are either the feature branch
 * someone just finished translating or a merge that went the wrong way, and
 * those look identical until the keys are on screen.
 *
 * Categories are ordered by what they cost. Overwrites first, because they are
 * the only ones that destroy something. Then what is added, then what is kept
 * for want of anywhere to send it.
 */
export function formatDetails(locales: LocaleReport[], sides: Sides, verbose: boolean): string {
  const limit = verbose ? Infinity : PREVIEW
  const sections: string[] = []

  for (const { label, report } of locales) {
    const blocks: string[] = []

    if (report.overwrites.length) {
      blocks.push(list(
        `${report.overwrites.length} ${plural(report.overwrites.length, 'value')} would be replaced`,
        report.overwrites.map((entry) => overwriteLines(entry, sides)),
        limit
      ))
    }
    if (report.added.length) {
      blocks.push(list(
        `${report.added.length} ${plural(report.added.length, 'key')} would be added`,
        report.added.map((key) => [key]),
        limit
      ))
    }
    if (report.notInLangHub.length) {
      blocks.push(list(
        `${report.notInLangHub.length} ${plural(report.notInLangHub.length, 'key')} here but not in LangHub — kept, upload them`,
        report.notInLangHub.map((key) => [key]),
        limit
      ))
    }

    if (blocks.length) sections.push(`\n${label}\n${blocks.join('\n')}`)
  }

  return sections.join('\n')
}

function overwriteLines({ key, from, to }: Overwrite, sides: Sides): string[] {
  return [key, `  ${sides.from} ${truncate(from)}`, `  ${sides.to} ${truncate(to)}`]
}

/** Indentation lives here rather than in each producer, so it cannot drift. */
function list(heading: string, entries: string[][], limit: number): string {
  const shown = entries.slice(0, limit)
  const lines = [`  ${heading}:`, ...shown.flat().map((line) => `    ${line}`)]
  if (entries.length > shown.length) {
    lines.push(`    ... and ${entries.length - shown.length} more (--verbose to list them)`)
  }
  return lines.join('\n')
}

const plural = (count: number, word: string) => (count === 1 ? word : `${word}s`)

function truncate(value: string, max = 90): string {
  const flat = value.replace(/\n/g, '\\n')
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}
