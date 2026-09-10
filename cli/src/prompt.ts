import { createInterface, type Interface } from 'node:readline'
import type { Readable, Writable } from 'node:stream'

export interface Ask {
  input: Readable & { isTTY?: boolean }
  output: Writable
}

/**
 * One open question-asker for a whole run.
 *
 * Deliberately not one readline interface per question: closing an interface
 * takes the shared input with it, so the second question would read from a
 * stream the first one already finished with and wait forever.
 *
 * Lines are queued rather than read on demand, because readline emits every
 * line it already has as soon as it has them. `question()` captures the first
 * and the rest are dropped on the floor — which is invisible with someone
 * typing, and hangs the moment input arrives as a block, as it does from a
 * pipe or a here-doc.
 */
export interface Prompter {
  ask(question: string): Promise<string | null>
  close(): void
}

/**
 * Every path that is not an explicit reply — no terminal, a stream that ended,
 * a read that failed — answers null, and every caller reads null as "do not
 * proceed". A prompt that falls through to yes on CI is not a confirmation, it
 * is a delay: the one place where an unattended run overwrites a translator's
 * work is the one place the question mattered.
 */
export function createPrompter(io: Ask = { input: process.stdin, output: process.stdout }): Prompter {
  if (!io.input.isTTY) {
    return { ask: async () => null, close: () => undefined }
  }

  const readline: Interface = createInterface({ input: io.input, output: io.output, terminal: false })
  const pending: string[] = []
  const waiting: Array<(line: string | null) => void> = []
  let closed = false

  readline.on('line', (line) => {
    const next = waiting.shift()
    if (next) next(line)
    else pending.push(line)
  })
  readline.once('close', () => {
    closed = true
    while (waiting.length) waiting.shift()!(null)
  })

  return {
    async ask(question) {
      const buffered = pending.shift()
      if (buffered !== undefined) {
        io.output.write(`${question}${buffered}\n`)
        return buffered
      }
      if (closed) return null
      io.output.write(question)
      return new Promise<string | null>((resolve) => waiting.push(resolve))
    },
    close() {
      readline.close()
    },
  }
}

export type Plan = 'all' | 'none' | 'review'

/** What to do with a batch of overwrites: take them, skip them, or go through them. */
export async function askPlan(question: string, prompter: Prompter): Promise<Plan> {
  const answer = await prompter.ask(`${question} [y]es all / [N]o / [r]eview each: `)
  const normalized = answer?.trim().toLowerCase() ?? ''
  if (/^(y|yes|a|all)$/.test(normalized)) return 'all'
  if (/^(r|review)$/.test(normalized)) return 'review'
  return 'none'
}

export type Decision = 'take' | 'keep' | 'take-rest' | 'keep-rest' | 'quit'

/**
 * What to do with one value. The two "rest" answers exist because reviewing is
 * how someone finds the one key they care about — once they have found it, or
 * ruled it out, making them press a key for another two hundred is a good way
 * to teach them to always answer "yes all" instead.
 */
export async function askDecision(prompter: Prompter): Promise<Decision> {
  const answer = await prompter.ask('  [y]take / [N]keep / [a]take rest / [k]keep rest / [q]uit: ')
  switch (answer?.trim().toLowerCase()) {
    case 'y': case 'yes': return 'take'
    case 'a': case 'all': return 'take-rest'
    case 'k': return 'keep-rest'
    case 'q': case 'quit': return 'quit'
    default: return 'keep'
  }
}
