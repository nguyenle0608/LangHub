import { describe, it, expect } from 'vitest'
import { PassThrough, Writable } from 'node:stream'
import { askDecision, askPlan, createPrompter } from '../prompt'
import { reviewOverwrites, wasTaken, type PendingOverwrite } from '../review'

// Every answer queued up front, read one line at a time by a single prompter —
// the same shape the CLI uses, where closing between questions would take the
// shared input with it.
function io(answers: string[], isTTY = true) {
  const input = new PassThrough() as PassThrough & { isTTY?: boolean }
  input.isTTY = isTTY
  input.write(answers.map((answer) => `${answer}\n`).join(''))
  return createPrompter({ input, output: new Writable({ write(_c, _e, done) { done() } }) })
}

const overwrite = (label: string, key: string): PendingOverwrite =>
  ({ label, key, from: `local ${key}`, to: `hub ${key}` })

const NOOP = () => undefined

describe('askPlan', () => {
  it('understands the three ways out', async () => {
    expect(await askPlan('?', io(['y']))).toBe('all')
    expect(await askPlan('?', io(['r']))).toBe('review')
    expect(await askPlan('?', io(['n']))).toBe('none')
  })

  it('defaults to doing nothing on Enter or anything unrecognised', async () => {
    expect(await askPlan('?', io(['']))).toBe('none')
    expect(await askPlan('?', io(['maybe']))).toBe('none')
  })

  it('refuses without a terminal rather than assuming yes', async () => {
    expect(await askPlan('?', io(['y'], false))).toBe('none')
  })
})

describe('askDecision', () => {
  it('keeps the local value unless told otherwise', async () => {
    expect(await askDecision(io(['']))).toBe('keep')
    expect(await askDecision(io(['n']))).toBe('keep')
    expect(await askDecision(io(['y']))).toBe('take')
    expect(await askDecision(io(['a']))).toBe('take-rest')
    expect(await askDecision(io(['k']))).toBe('keep-rest')
    expect(await askDecision(io(['q']))).toBe('quit')
  })
})

describe('reviewOverwrites', () => {
  const three = [overwrite('vi-VN', 'a'), overwrite('vi-VN', 'b'), overwrite('fr-FR', 'c')]

  it('records a decision per key', async () => {
    const { taken, aborted } = await reviewOverwrites(three, NOOP, io(['y', 'n', 'y']))

    expect(aborted).toBe(false)
    expect(wasTaken(taken, 'vi-VN', 'a')).toBe(true)
    expect(wasTaken(taken, 'vi-VN', 'b')).toBe(false)
    expect(wasTaken(taken, 'fr-FR', 'c')).toBe(true)
  })

  it('distinguishes the same key in two locales', async () => {
    // Without the label in the identity, deciding on vi-VN's copy would decide
    // for every other language too.
    const same = [overwrite('vi-VN', 'shared'), overwrite('fr-FR', 'shared')]
    const { taken } = await reviewOverwrites(same, NOOP, io(['y', 'n']))

    expect(wasTaken(taken, 'vi-VN', 'shared')).toBe(true)
    expect(wasTaken(taken, 'fr-FR', 'shared')).toBe(false)
  })

  it('takes the rest without asking again', async () => {
    const { taken } = await reviewOverwrites(three, NOOP, io(['n', 'a']))

    expect(wasTaken(taken, 'vi-VN', 'a')).toBe(false)
    expect(wasTaken(taken, 'vi-VN', 'b')).toBe(true)
    expect(wasTaken(taken, 'fr-FR', 'c')).toBe(true)
  })

  it('keeps the rest without asking again', async () => {
    const { taken } = await reviewOverwrites(three, NOOP, io(['y', 'k']))

    expect(wasTaken(taken, 'vi-VN', 'a')).toBe(true)
    expect(taken.size).toBe(1)
  })

  it('discards earlier decisions when the reviewer quits', async () => {
    // Quitting halfway must not half-apply: someone who stops is saying they
    // do not trust the run, not that the first few were fine.
    const { taken, aborted } = await reviewOverwrites(three, NOOP, io(['y', 'q']))

    expect(aborted).toBe(true)
    expect(taken.size).toBe(0)
  })

  it('keeps everything when there is no terminal to review with', async () => {
    const { taken, aborted } = await reviewOverwrites(three, NOOP, io([], false))

    expect(aborted).toBe(false)
    expect(taken.size).toBe(0)
  })

  it('shows each value it is asking about', async () => {
    const seen: string[] = []
    await reviewOverwrites(three, (item, index, count) => seen.push(`${index + 1}/${count} ${item.key}`), io(['n', 'n', 'n']))

    expect(seen).toEqual(['1/3 a', '2/3 b', '3/3 c'])
  })
})
