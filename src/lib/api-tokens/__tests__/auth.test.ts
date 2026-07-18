import { describe, expect, it, vi } from 'vitest'
import { authenticateApiToken, type ApiTokenStore, type StoredApiToken } from '../auth'
import { generateApiToken } from '../token'

const now = new Date('2026-07-18T10:00:00.000Z')

function request(token?: string, scheme = 'Bearer') {
  return new Request('https://langhub.dev/api/v1/projects', {
    headers: token ? { authorization: `${scheme} ${token}` } : {},
  })
}

function stored(overrides: Partial<StoredApiToken> = {}): StoredApiToken {
  return {
    tokenId: 'token-1',
    orgId: 'org-1',
    scope: 'read',
    createdBy: 'user-1',
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: null,
    ...overrides,
  }
}

function store(value: StoredApiToken | null) {
  return {
    findByHash: vi.fn().mockResolvedValue(value),
    touchLastUsed: vi.fn().mockResolvedValue(undefined),
  } satisfies ApiTokenStore
}

describe('authenticateApiToken', () => {
  it('authenticates an active bearer token and returns a minimal context', async () => {
    const credential = generateApiToken()
    const tokenStore = store(stored())
    await expect(authenticateApiToken(request(credential), { store: tokenStore, now })).resolves.toEqual({
      tokenId: 'token-1', orgId: 'org-1', scope: 'read', createdBy: 'user-1',
    })
    expect(tokenStore.touchLastUsed).toHaveBeenCalledWith('token-1', now.toISOString())
  })

  it.each([
    ['missing', request()],
    ['wrong scheme', request(generateApiToken(), 'Basic')],
    ['malformed', request('lh_short')],
  ])('returns the same null outcome for %s credentials', async (_label, input) => {
    const tokenStore = store(stored())
    await expect(authenticateApiToken(input, { store: tokenStore, now })).resolves.toBeNull()
    expect(tokenStore.findByHash).not.toHaveBeenCalled()
  })

  it.each([
    ['unknown', null],
    ['revoked', stored({ revokedAt: '2026-07-18T09:00:00.000Z' })],
    ['expired', stored({ expiresAt: '2026-07-18T10:00:00.000Z' })],
  ])('returns the same null outcome for an %s token', async (_label, value) => {
    const tokenStore = store(value)
    await expect(authenticateApiToken(request(generateApiToken()), { store: tokenStore, now })).resolves.toBeNull()
    expect(tokenStore.touchLastUsed).not.toHaveBeenCalled()
  })

  it('throttles last-used writes within five minutes', async () => {
    const tokenStore = store(stored({ lastUsedAt: '2026-07-18T09:58:00.000Z' }))
    await expect(authenticateApiToken(request(generateApiToken()), { store: tokenStore, now })).resolves.not.toBeNull()
    expect(tokenStore.touchLastUsed).not.toHaveBeenCalled()
  })

  it('does not fail authentication if usage metadata cannot be updated', async () => {
    const tokenStore = store(stored())
    tokenStore.touchLastUsed.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(authenticateApiToken(request(generateApiToken()), { store: tokenStore, now })).resolves.not.toBeNull()
  })
})

