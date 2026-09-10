import { describe, it, expect } from 'vitest'
import { diffForPush, emptyReport, merge } from '../sync'

describe('diffForPush', () => {
  const hub = { same: 'A', differs: 'HUB', onlyHub: 'only in LangHub' }
  const local = { same: 'A', differs: 'LOCAL', onlyLocal: 'only in the repo' }

  it('sends what LangHub does not have, and what it has differently', () => {
    const report = emptyReport()
    const outgoing = diffForPush(local, hub, report)

    expect(outgoing).toEqual({ differs: 'LOCAL', onlyLocal: 'only in the repo' })
    expect(report.added).toEqual(['onlyLocal'])
    expect(report.overwrites).toEqual([{ key: 'differs', from: 'HUB', to: 'LOCAL' }])
  })

  it('sends nothing for a value that already matches', () => {
    const report = emptyReport()
    expect(diffForPush({ same: 'A' }, hub, report)).toEqual({})
    expect(report.added).toEqual([])
    expect(report.overwrites).toEqual([])
  })

  it('never proposes to remove a key only LangHub has', () => {
    // An import writes only the keys it names. Reading absence as deletion
    // would let one stale checkout wipe work nobody in this push knew about.
    const report = emptyReport()
    const outgoing = diffForPush(local, hub, report)

    expect('onlyHub' in outgoing).toBe(false)
    expect(JSON.stringify(report)).not.toContain('onlyHub')
  })

  it('names the destroyed value as `from` in both directions', () => {
    // The two commands share one review screen, which prints `from` as the
    // value at stake. Getting this backwards would show the reviewer the value
    // that is about to be written as though it were the one being lost.
    const pullReport = emptyReport()
    merge({ k: 'INCOMING' }, { k: 'AT RISK' }, pullReport)
    expect(pullReport.overwrites[0]).toEqual({ key: 'k', from: 'AT RISK', to: 'INCOMING' })

    const pushReport = emptyReport()
    diffForPush({ k: 'INCOMING' }, { k: 'AT RISK' }, pushReport)
    expect(pushReport.overwrites[0]).toEqual({ key: 'k', from: 'AT RISK', to: 'INCOMING' })
  })
})
