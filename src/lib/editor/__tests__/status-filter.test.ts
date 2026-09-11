import { describe, it, expect } from 'vitest'
import {
  STATUS_ORDER,
  formatStatusList,
  matchesColumnStatus,
  matchesKeyStatus,
  toggleStatus,
  type KeyStatus,
} from '../status-filter'

const set = (...s: KeyStatus[]) => new Set<KeyStatus>(s)

describe('toggleStatus', () => {
  it('adds a status that is not selected', () => {
    expect(toggleStatus(set(), 'pending')).toEqual(set('pending'))
  })

  it('removes a status that is selected', () => {
    expect(toggleStatus(set('empty', 'pending'), 'pending')).toEqual(set('empty'))
  })

  it('never mutates the set it was given', () => {
    const original = set('empty')
    toggleStatus(original, 'pending')
    expect(original).toEqual(set('empty'))
  })

  it('returns a new set each time, so React sees the change', () => {
    const original = set('empty')
    expect(toggleStatus(original, 'pending')).not.toBe(original)
  })
})

describe('matchesKeyStatus', () => {
  it('matches every key when nothing is selected', () => {
    for (const status of STATUS_ORDER) {
      expect(matchesKeyStatus(set(), status)).toBe(true)
    }
  })

  it('matches exactly one status when one is selected', () => {
    expect(matchesKeyStatus(set('pending'), 'pending')).toBe(true)
    expect(matchesKeyStatus(set('pending'), 'reviewed')).toBe(false)
  })

  it('matches either status when two are selected', () => {
    const selected = set('empty', 'pending')
    expect(matchesKeyStatus(selected, 'empty')).toBe(true)
    expect(matchesKeyStatus(selected, 'pending')).toBe(true)
    expect(matchesKeyStatus(selected, 'reviewed')).toBe(false)
    expect(matchesKeyStatus(selected, 'approved')).toBe(false)
  })
})

describe('matchesColumnStatus', () => {
  const approved = { value: 'Hello', status: 'approved' }
  const pending = { value: 'Hello', status: 'pending' }
  const blank = { value: '', status: 'pending' }

  it('matches every row when nothing is selected', () => {
    expect(matchesColumnStatus(set(), approved)).toBe(true)
    expect(matchesColumnStatus(set(), undefined)).toBe(true)
  })

  it('matches a single selected status', () => {
    expect(matchesColumnStatus(set('approved'), approved)).toBe(true)
    expect(matchesColumnStatus(set('approved'), pending)).toBe(false)
  })

  it('matches either status when two are selected', () => {
    const selected = set('pending', 'approved')
    expect(matchesColumnStatus(selected, pending)).toBe(true)
    expect(matchesColumnStatus(selected, approved)).toBe(true)
    expect(matchesColumnStatus(selected, { value: 'Hi', status: 'reviewed' })).toBe(false)
  })

  it('treats a missing translation as empty', () => {
    expect(matchesColumnStatus(set('empty'), undefined)).toBe(true)
  })

  it('treats a translation with no value as empty, whatever its status says', () => {
    expect(matchesColumnStatus(set('empty'), blank)).toBe(true)
    expect(matchesColumnStatus(set('empty'), { value: null, status: 'pending' })).toBe(true)
  })

  it('treats an explicit empty status as empty even with a value', () => {
    expect(matchesColumnStatus(set('empty'), { value: 'stale', status: 'empty' })).toBe(true)
  })

  it('does not match a filled row against empty alone', () => {
    expect(matchesColumnStatus(set('empty'), approved)).toBe(false)
  })

  it('matches a blank row when empty is selected alongside another status', () => {
    expect(matchesColumnStatus(set('empty', 'approved'), blank)).toBe(true)
    expect(matchesColumnStatus(set('empty', 'approved'), approved)).toBe(true)
    expect(matchesColumnStatus(set('empty', 'approved'), pending)).toBe(false)
  })
})

describe('formatStatusList', () => {
  it('is empty when nothing is selected', () => {
    expect(formatStatusList(set())).toBe('')
  })

  it('uses the human label, not the stored value', () => {
    expect(formatStatusList(set('empty'))).toBe('Untranslated')
  })

  it('reads the same however the statuses were clicked', () => {
    const label = 'Untranslated, Pending, Reviewed'
    expect(formatStatusList(set('empty', 'pending', 'reviewed'))).toBe(label)
    expect(formatStatusList(set('reviewed', 'empty', 'pending'))).toBe(label)
    expect(formatStatusList(set('pending', 'reviewed', 'empty'))).toBe(label)
  })
})
