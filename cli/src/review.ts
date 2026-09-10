import { askDecision, type Decision, type Prompter } from './prompt.js'
import type { Overwrite } from './sync.js'

/** One overwrite, with the file it belongs to. */
export interface PendingOverwrite extends Overwrite {
  label: string
}

export interface ReviewOutcome {
  /** Keys, by label, whose LangHub value the reviewer accepted. */
  taken: Set<string>
  /** True when the reviewer quit: nothing should be written at all. */
  aborted: boolean
}

const identify = (item: { label: string; key: string }) => `${item.label} ${item.key}`

/**
 * Walk the overwrites one at a time and collect a decision for each.
 *
 * Rejecting an overwrite is not "skip this file" — the rest of that file still
 * gets its new keys and its accepted values. Only the specific value is kept,
 * which is what makes this different from answering no to everything.
 *
 * `show` is injected so the caller owns the formatting and this stays about
 * the decisions.
 */
export async function reviewOverwrites(
  pending: PendingOverwrite[],
  show: (item: PendingOverwrite, index: number, total: number) => void,
  prompter: Prompter
): Promise<ReviewOutcome> {
  const taken = new Set<string>()

  for (let index = 0; index < pending.length; index++) {
    const item = pending[index]!
    show(item, index, pending.length)
    const decision: Decision = await askDecision(prompter)

    if (decision === 'quit') return { taken: new Set(), aborted: true }
    if (decision === 'take') taken.add(identify(item))
    if (decision === 'take-rest') {
      for (const rest of pending.slice(index)) taken.add(identify(rest))
      break
    }
    if (decision === 'keep-rest') break
  }

  return { taken, aborted: false }
}

export function wasTaken(taken: Set<string>, label: string, key: string): boolean {
  return taken.has(identify({ label, key }))
}
