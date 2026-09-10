import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rotationError, MAX_ROTATION_GRACE_MINUTES } from '../management'
import { authenticateApiToken } from '../auth'
import { generateApiToken, hashApiToken } from '../token'

describe('rotationError', () => {
  it('separates the reasons a rotation can fail, so each gets its own status', () => {
    expect(rotationError('active_token_limit exceeded')).toBe('limit')
    expect(rotationError('token_not_found')).toBe('not_found')
    expect(rotationError('token_not_active')).toBe('not_active')
  })

  it('treats anything it does not recognise as a server fault, not a user error', () => {
    expect(rotationError('deadlock detected')).toBe('database')
    expect(rotationError(undefined)).toBe('database')
  })
})

describe('grace period bound', () => {
  it('stops at a day — a grace period is a deploy window, not a second credential', () => {
    expect(MAX_ROTATION_GRACE_MINUTES).toBe(24 * 60)
  })
})

/**
 * The behaviour rotation depends on: a token retired with a future expires_at
 * keeps authenticating until that moment, and stops afterwards. This is why the
 * old secret is retired through expires_at and not revoked_at — the check below
 * rejects any non-null revoked_at outright, whatever its timestamp.
 */
describe('a rotated token during and after its grace period', () => {
  const secret = generateApiToken()
  const base: {
    tokenId: string; orgId: string; scope: 'read'
    createdBy: string | null; revokedAt: string | null; lastUsedAt: string | null
  } = {
    tokenId: 't1', orgId: 'o1', scope: 'read',
    createdBy: 'u1', revokedAt: null, lastUsedAt: null,
  }
  const request = { headers: new Headers({ Authorization: `Bearer ${secret}` }) }
  const store = (overrides: Partial<typeof base> & { expiresAt: string | null }) => ({
    findByHash: vi.fn(async (hash: string) => hash === hashApiToken(secret) ? { ...base, ...overrides } : null),
    touchLastUsed: vi.fn(async () => undefined),
  })

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('still works inside the window', async () => {
    const context = await authenticateApiToken(request, {
      store: store({ expiresAt: '2026-01-01T01:00:00Z' }),
    })
    expect(context?.tokenId).toBe('t1')
  })

  it('stops the moment the window closes', async () => {
    const context = await authenticateApiToken(request, {
      store: store({ expiresAt: '2026-01-01T01:00:00Z' }),
      now: new Date('2026-01-01T01:00:00Z'),
    })
    expect(context).toBeNull()
  })

  it('is dead immediately when revoked with no grace, whatever expires_at says', async () => {
    const context = await authenticateApiToken(request, {
      store: store({ expiresAt: '2027-01-01T00:00:00Z', revokedAt: '2026-01-01T00:00:00Z' }),
    })
    expect(context).toBeNull()
  })
})
