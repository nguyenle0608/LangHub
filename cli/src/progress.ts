import type { Writable } from 'node:stream'

export interface ProgressOutput {
  stream: Writable & { isTTY?: boolean }
}

export interface Progress {
  /** Announce the step about to run. */
  step(label: string): void
  /** Clear the line, so whatever prints next starts clean. */
  done(): void
}

/**
 * Say what is happening while it happens.
 *
 * Fifteen locales is about forty seconds of nothing, which reads as a hung
 * command rather than a working one — and the first thing someone does to a
 * command that looks hung is interrupt it.
 *
 * A terminal gets one line that rewrites itself. Anything else — a pipe, a CI
 * log — gets one line per step, because carriage returns in a log file produce
 * a single unreadable line, and because a build log is read after the fact,
 * where every step mattering equally is the point.
 */
export function createProgress(
  total: number,
  io: ProgressOutput = { stream: process.stderr }
): Progress {
  let index = 0
  const interactive = Boolean(io.stream.isTTY)
  let width = 0

  return {
    step(label) {
      index++
      const line = `  [${index}/${total}] ${label}`
      if (!interactive) {
        io.stream.write(`${line}\n`)
        return
      }
      // Pad to the previous width so a shorter line does not leave the tail of
      // a longer one behind it.
      io.stream.write(`\r${line.padEnd(width)}`)
      width = Math.max(width, line.length)
    },
    done() {
      if (interactive && width > 0) io.stream.write(`\r${' '.repeat(width)}\r`)
    },
  }
}

/**
 * Progress goes to stderr, not stdout.
 *
 * The plan is the command's output, and someone piping it to a file or a diff
 * should get the plan alone. Progress is commentary on the wait, and belongs
 * with the other commentary.
 */
export const PROGRESS_STREAM = 'stderr'
