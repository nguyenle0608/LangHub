import { describe, it, expect } from 'vitest'
import { completionPercent } from '../completion'

describe('completionPercent', () => {
  describe('100 means finished', () => {
    it('reports 100 only when every unit is done', () => {
      expect(completionPercent(720, 720)).toBe(100)
    })

    it('does not round up to 100 when something is left', () => {
      // The case this exists for. 717 of 720 is what thirteen of sixteen
      // languages looked like on a real project, every one of them reported as
      // complete while missing three keys.
      expect(completionPercent(717, 720)).toBe(99)
      expect(completionPercent(719, 720)).toBe(99)
    })

    it('holds at 99 however close it gets', () => {
      expect(completionPercent(9_999, 10_000)).toBe(99)
      expect(completionPercent(999_999, 1_000_000)).toBe(99)
    })
  })

  describe('0 means nothing started', () => {
    it('reports 0 only when nothing is done', () => {
      expect(completionPercent(0, 720)).toBe(0)
    })

    it('does not round down to 0 once something is done', () => {
      // 0% and "three keys translated" are not the same state, and showing
      // them the same way is discouraging in a way the number does not intend.
      expect(completionPercent(3, 1000)).toBe(1)
      expect(completionPercent(1, 1_000_000)).toBe(1)
    })
  })

  it('rounds normally in between', () => {
    expect(completionPercent(1, 2)).toBe(50)
    expect(completionPercent(1, 3)).toBe(33)
    expect(completionPercent(2, 3)).toBe(67)
    expect(completionPercent(360, 720)).toBe(50)
  })

  describe('nothing to measure', () => {
    it('is 0 for an empty total rather than NaN', () => {
      expect(completionPercent(0, 0)).toBe(0)
      expect(completionPercent(5, 0)).toBe(0)
    })

    it('is 0 for a negative total', () => {
      expect(completionPercent(5, -1)).toBe(0)
    })

    it('is 0 rather than NaN when a count is not a number', () => {
      // These arrive from counts that can be null on an empty branch.
      expect(completionPercent(NaN, 100)).toBe(0)
      expect(completionPercent(10, NaN)).toBe(0)
      // Infinity is treated the same way, not as "more than complete": a count
      // that is not a real number is a bug upstream, and reporting it as
      // finished would hide that behind the one value nobody questions.
      expect(completionPercent(Infinity, 100)).toBe(0)
    })
  })

  it('treats more than complete as complete, not as over 100', () => {
    expect(completionPercent(721, 720)).toBe(100)
  })

  it('is never below 0 or above 100', () => {
    for (const [done, total] of [[0, 1], [1, 1], [-5, 10], [50, 100], [99, 100], [100, 100]]) {
      const value = completionPercent(done!, total!)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })
})
