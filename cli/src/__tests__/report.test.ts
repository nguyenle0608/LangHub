import { describe, it, expect } from 'vitest'
import { formatDetails, formatPlan, PULL_SIDES, PUSH_SIDES } from '../report'
import { emptyReport, type Report } from '../sync'

function report(overrides: Partial<Report> = {}): Report {
  return { ...emptyReport(), ...overrides }
}

describe('formatPlan', () => {
  it('names every category that has something in it', () => {
    const line = formatPlan('vi-VN -> vi-VN.json', report({
      added: ['a', 'b'],
      overwrites: [{ key: 'c', from: 'x', to: 'y' }],
      notInLangHub: ['d'],
    }))
    expect(line).toContain('2 added, 1 overwritten, 1 kept')
  })

  it('says so plainly when there is nothing', () => {
    expect(formatPlan('vi-VN -> vi-VN.json', report())).toContain('no change')
  })
})

describe('formatDetails', () => {
  const full = report({
    added: ['new.one', 'new.two'],
    overwrites: [{ key: 'shared.title', from: 'local value', to: 'hub value' }],
    notInLangHub: ['only.here'],
  })

  it('lists the keys, not only how many', () => {
    // A count answers "is there anything to commit"; it does not answer "is
    // this the change I meant to make".
    const text = formatDetails([{ label: 'vi-VN', report: full }], PULL_SIDES, false)

    expect(text).toContain('new.one')
    expect(text).toContain('new.two')
    expect(text).toContain('only.here')
    expect(text).toContain('shared.title')
  })

  it('puts what would be destroyed first', () => {
    const text = formatDetails([{ label: 'vi-VN', report: full }], PULL_SIDES, false)
    expect(text.indexOf('would be replaced')).toBeLessThan(text.indexOf('would be added'))
  })

  it('shows both values, with the one at stake first', () => {
    const text = formatDetails([{ label: 'vi-VN', report: full }], PULL_SIDES, false)
    expect(text.indexOf('local value')).toBeLessThan(text.indexOf('hub value'))
  })

  it('flips the labels for a push, where LangHub is what is destroyed', () => {
    const text = formatDetails([{ label: 'vi-VN', report: full }], PUSH_SIDES, false)
    const stake = text.indexOf('LangHub: local value')
    expect(stake).toBeGreaterThan(-1)
    expect(stake).toBeLessThan(text.indexOf('here:    hub value'))
  })

  it('separates the locales', () => {
    const text = formatDetails([
      { label: 'vi-VN', report: report({ added: ['a'] }) },
      { label: 'fr-FR', report: report({ added: ['b'] }) },
    ], PULL_SIDES, false)

    expect(text).toContain('vi-VN')
    expect(text).toContain('fr-FR')
    expect(text.indexOf('vi-VN')).toBeLessThan(text.indexOf('fr-FR'))
  })

  it('skips a locale with nothing to say', () => {
    const text = formatDetails([
      { label: 'vi-VN', report: report({ added: ['a'] }) },
      { label: 'fr-FR', report: report() },
    ], PULL_SIDES, false)

    expect(text).not.toContain('fr-FR')
  })

  it('caps a long list and says how to see the rest', () => {
    const many = report({ added: Array.from({ length: 14 }, (_, i) => `key${i + 1}`) })
    const text = formatDetails([{ label: 'vi-VN', report: many }], PULL_SIDES, false)

    expect(text).toContain('key10')
    expect(text).not.toContain('key11')
    expect(text).toContain('... and 4 more (--verbose to list them)')
  })

  it('lists everything under --verbose', () => {
    const many = report({ added: Array.from({ length: 14 }, (_, i) => `key${i + 1}`) })
    const text = formatDetails([{ label: 'vi-VN', report: many }], PULL_SIDES, true)

    expect(text).toContain('key14')
    expect(text).not.toContain('more (--verbose')
  })

  it('indents entries below their heading', () => {
    // They were level with it, which made a key read as another category.
    const text = formatDetails([{ label: 'vi-VN', report: report({ added: ['a.key'] }) }], PULL_SIDES, false)
    expect(text).toContain('  1 key would be added:\n    a.key')
  })

  it('returns nothing at all when no locale has anything', () => {
    expect(formatDetails([{ label: 'vi-VN', report: report() }], PULL_SIDES, false)).toBe('')
  })

  it('keeps a multi-line value on one line', () => {
    const text = formatDetails([{
      label: 'vi-VN',
      report: report({ overwrites: [{ key: 'k', from: 'line one\nline two', to: 'x' }] }),
    }], PULL_SIDES, false)

    expect(text).toContain('line one\\nline two')
  })
})
