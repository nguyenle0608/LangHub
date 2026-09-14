import { describe, it, expect } from 'vitest'
import { isFlagEnabled } from '../env-flags'

describe('isFlagEnabled', () => {
  it('is off when the variable is not set', () => {
    // The default has to be off: a feature flag that turns itself on when the
    // deployment forgot it is not a flag.
    expect(isFlagEnabled(undefined)).toBe(false)
    expect(isFlagEnabled('')).toBe(false)
    expect(isFlagEnabled('   ')).toBe(false)
  })

  it('accepts the spellings someone plainly meant as yes', () => {
    // The case this exists for: PUBLIC_API_ENABLED was set to TRUE, and every
    // v1 endpoint answered 404 — indistinguishable from a deployment that had
    // not been rebuilt, or from a wrong project id.
    for (const value of ['true', 'TRUE', 'True', ' true ', '1', 'yes', 'YES', 'on']) {
      expect(isFlagEnabled(value), value).toBe(true)
    }
  })

  it('stays off for anything that is not one', () => {
    for (const value of ['false', 'FALSE', '0', 'no', 'off', 'enabled', 'null', '"true"', 'true-ish']) {
      expect(isFlagEnabled(value), value).toBe(false)
    }
  })

  it('does not read a quoted value as set', () => {
    // A .env file written as KEY="true" can arrive with the quotes attached.
    // Treating that as on would hide the mistake rather than surface it, and
    // the surrounding quotes are a sign the file is being read wrong.
    expect(isFlagEnabled('"true"')).toBe(false)
    expect(isFlagEnabled("'true'")).toBe(false)
  })
})
