import { describe, it, expect } from 'vitest'
import { Writable } from 'node:stream'
import { createProgress } from '../progress'

function capture(isTTY: boolean) {
  const written: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, done) { written.push(String(chunk)); done() },
  }) as Writable & { isTTY?: boolean }
  stream.isTTY = isTTY
  return { stream, written }
}

describe('createProgress', () => {
  it('rewrites one line in a terminal', () => {
    const { stream, written } = capture(true)
    const progress = createProgress(2, { stream })
    progress.step('Reading vi-VN')
    progress.step('Reading fr-FR')

    expect(written.every((line) => line.startsWith('\r'))).toBe(true)
    expect(written.some((line) => line.includes('\n'))).toBe(false)
    expect(written[0]).toContain('[1/2] Reading vi-VN')
    expect(written[1]).toContain('[2/2] Reading fr-FR')
  })

  it('leaves the line clean for whatever prints next', () => {
    // The plan prints straight after. A leftover step line above it reads as
    // part of the plan.
    const { stream, written } = capture(true)
    const progress = createProgress(1, { stream })
    progress.step('Reading vi-VN')
    progress.done()

    expect(written.at(-1)).toMatch(/^\r +\r$/)
  })

  it('pads over a longer previous line', () => {
    // Without padding, "Reading a" after "Reading longer-locale" leaves the
    // tail of the longer one on screen.
    const { stream, written } = capture(true)
    const progress = createProgress(2, { stream })
    progress.step('Reading a-very-long-locale-name')
    progress.step('Reading x')

    expect(written[1]!.length).toBeGreaterThanOrEqual(written[0]!.length)
  })

  it('prints one line per step when it is not a terminal', () => {
    // Carriage returns in a CI log produce a single unreadable line, and a log
    // is read after the fact, where every step matters equally.
    const { stream, written } = capture(false)
    const progress = createProgress(2, { stream })
    progress.step('Reading vi-VN')
    progress.step('Reading fr-FR')
    progress.done()

    expect(written).toEqual(['  [1/2] Reading vi-VN\n', '  [2/2] Reading fr-FR\n'])
  })

  it('writes nothing on done when nothing was stepped', () => {
    const { stream, written } = capture(true)
    createProgress(0, { stream }).done()
    expect(written).toEqual([])
  })
})
