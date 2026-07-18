import { describe, it, expect } from 'vitest'
import { roleAtLeast } from '../access'

describe('roleAtLeast', () => {
  it('treats a null role as no access', () => {
    expect(roleAtLeast(null, 'viewer')).toBe(false)
  })

  it('grants when the role meets or exceeds the minimum', () => {
    expect(roleAtLeast('viewer', 'viewer')).toBe(true)
    expect(roleAtLeast('translator', 'viewer')).toBe(true)
    expect(roleAtLeast('admin', 'translator')).toBe(true)
    expect(roleAtLeast('owner', 'admin')).toBe(true)
  })

  it('denies when the role is below the minimum', () => {
    expect(roleAtLeast('viewer', 'translator')).toBe(false)
    expect(roleAtLeast('translator', 'admin')).toBe(false)
    expect(roleAtLeast('admin', 'owner')).toBe(false)
  })
})
