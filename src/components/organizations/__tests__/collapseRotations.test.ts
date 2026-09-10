import { describe, it, expect } from 'vitest'
import { collapseRotations } from '../ApiTokensPanel'
import type { ApiTokenMetadata } from '@/lib/api-tokens/management'

const NOW = new Date('2026-01-01T12:00:00Z').getTime()
const at = (offsetMinutes: number) => new Date(NOW + offsetMinutes * 60_000).toISOString()

function token(id: string, overrides: Partial<ApiTokenMetadata> = {}): ApiTokenMetadata {
  return {
    id, name: 'CI', tokenPrefix: `lh_${id}`, scope: 'read',
    lastUsedAt: null, expiresAt: null, revokedAt: null,
    createdAt: at(-1000), createdBy: 'u1', replacedBy: null,
    ...overrides,
  }
}

describe('collapseRotations', () => {
  it('shows one row per token, not one per secret', () => {
    const rows = collapseRotations([
      token('new'),
      token('old', { replacedBy: 'new', expiresAt: at(30) }),
    ], NOW)

    expect(rows).toHaveLength(1)
    expect(rows[0]!.token.id).toBe('new')
    expect(rows[0]!.previous?.id).toBe('old')
  })

  it('drops the deadline once the grace period has passed', () => {
    const rows = collapseRotations([
      token('new'),
      token('old', { replacedBy: 'new', expiresAt: at(-1) }),
    ], NOW)

    expect(rows).toHaveLength(1)
    expect(rows[0]!.previous).toBeNull()
  })

  it('drops it as soon as the previous secret is revoked early', () => {
    const rows = collapseRotations([
      token('new'),
      token('old', { replacedBy: 'new', expiresAt: at(30), revokedAt: at(-1) }),
    ], NOW)

    expect(rows[0]!.previous).toBeNull()
  })

  it('shows no deadline for a rotation with no grace at all', () => {
    // graceMinutes: 0 revokes instead of setting expires_at, so there is no
    // window to advertise — and nothing to offer revoking.
    const rows = collapseRotations([
      token('new'),
      token('old', { replacedBy: 'new', revokedAt: at(0) }),
    ], NOW)

    expect(rows).toHaveLength(1)
    expect(rows[0]!.previous).toBeNull()
  })

  it('keeps a chain of rotations down to a single row', () => {
    const rows = collapseRotations([
      token('c'),
      token('b', { replacedBy: 'c', expiresAt: at(30) }),
      token('a', { replacedBy: 'b', expiresAt: at(-100) }),
    ], NOW)

    expect(rows.map((row) => row.token.id)).toEqual(['c'])
    expect(rows[0]!.previous?.id).toBe('b')
  })

  it('leaves an ordinary revoked token visible — it was not replaced', () => {
    const rows = collapseRotations([token('live'), token('dead', { revokedAt: at(-10) })], NOW)
    expect(rows.map((row) => row.token.id)).toEqual(['live', 'dead'])
  })

  it('does not hide a token whose replacement is gone from the list', () => {
    // Defensive: a filtered or paginated list must never make a live token
    // invisible just because the row it points at is not present.
    const rows = collapseRotations([token('old', { replacedBy: 'missing' })], NOW)
    expect(rows.map((row) => row.token.id)).toEqual(['old'])
  })
})
