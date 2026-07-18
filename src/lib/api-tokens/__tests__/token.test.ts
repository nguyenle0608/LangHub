import { describe, expect, it } from 'vitest'
import { apiTokenDisplayPrefix, generateApiToken, hashApiToken, isValidApiToken } from '../token'

describe('API token primitives', () => {
  it('generates unique 256-bit URL-safe tokens in the LangHub format', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateApiToken))
    expect(tokens.size).toBe(100)
    for (const token of Array.from(tokens)) {
      expect(token).toHaveLength(46)
      expect(isValidApiToken(token)).toBe(true)
      expect(token).toMatch(/^lh_[A-Za-z0-9_-]{43}$/)
    }
  })

  it('rejects malformed or wrong-length credentials', () => {
    expect(isValidApiToken('')).toBe(false)
    expect(isValidApiToken('lh_short')).toBe(false)
    expect(isValidApiToken(`xx_${'a'.repeat(43)}`)).toBe(false)
    expect(isValidApiToken(`lh_${'a'.repeat(42)}!`)).toBe(false)
  })

  it('hashes deterministically without retaining the plaintext', () => {
    const token = `lh_${'a'.repeat(43)}`
    const hash = hashApiToken(token)
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashApiToken(token)).toBe(hash)
    expect(hash).not.toContain(token)
    expect(apiTokenDisplayPrefix(token)).toBe('lh_aaaaaaa…')
  })
})
