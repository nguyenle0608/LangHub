import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRateLimitStore } from '../rate-limit'
import type { ApiTokenStore, StoredApiToken } from '../auth'
import { authorizePublicApiRequest } from '../public-request'
import { generateApiToken } from '../token'

const token = generateApiToken()
const stored: StoredApiToken = {
  tokenId: 'token-1', orgId: 'org-1', scope: 'write', createdBy: null,
  revokedAt: null, expiresAt: null, lastUsedAt: '2026-07-18T09:59:00.000Z',
}

function request() {
  return new Request('https://langhub.dev/api/v1/projects', { headers: { Authorization: `Bearer ${token}`, 'X-Request-ID': 'request-1' } })
}

beforeEach(() => { process.env.PUBLIC_API_ENABLED = 'true' })
afterEach(() => { delete process.env.PUBLIC_API_ENABLED })

describe('public API request authorization', () => {
  const tokenStore: ApiTokenStore = { findByHash: vi.fn().mockResolvedValue(stored), touchLastUsed: vi.fn().mockResolvedValue(undefined) }
  const allowed: ApiRateLimitStore = { consume: vi.fn().mockResolvedValue({ allowed: true, remaining: 119, resetAt: '2026-07-18T10:01:00.000Z' }) }

  it('allows a write token to inherit read access and consumes the read quota', async () => {
    const result = await authorizePublicApiRequest(request(), 'read', { tokenStore, rateLimitStore: allowed, now: new Date('2026-07-18T10:00:00Z') })
    expect(result.ok).toBe(true)
    expect(allowed.consume).toHaveBeenCalledWith('token-1', 'read', 120, 60)
  })

  it('denies a read token on writes before rate-limit consumption', async () => {
    const readStore: ApiTokenStore = { ...tokenStore, findByHash: vi.fn().mockResolvedValue({ ...stored, scope: 'read' }) }
    const result = await authorizePublicApiRequest(request(), 'write', { tokenStore: readStore, rateLimitStore: allowed })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })

  it('returns 429 with retry headers without running endpoint work', async () => {
    const denied: ApiRateLimitStore = { consume: vi.fn().mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date(Date.now() + 30_000).toISOString() }) }
    const result = await authorizePublicApiRequest(request(), 'read', { tokenStore, rateLimitStore: denied })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(429)
      expect(result.response.headers.get('retry-after')).not.toBeNull()
    }
  })

  it('returns a generic 404 while the feature is disabled and never authenticates', async () => {
    delete process.env.PUBLIC_API_ENABLED
    const disabledStore: ApiTokenStore = { findByHash: vi.fn(), touchLastUsed: vi.fn() }
    const result = await authorizePublicApiRequest(request(), 'read', { tokenStore: disabledStore, rateLimitStore: allowed })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(await result.response.json()).toEqual({ error: 'Not found' })
    expect(disabledStore.findByHash).not.toHaveBeenCalled()
  })
})

