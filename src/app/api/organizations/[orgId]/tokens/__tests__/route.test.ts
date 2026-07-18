import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  assertOrgAccess: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}))
vi.mock('@/lib/auth/access', () => ({ assertOrgAccess: mocks.assertOrgAccess }))
vi.mock('@/lib/api-tokens/management', () => ({
  MAX_ACTIVE_API_TOKENS: 20,
  listOrganizationApiTokens: mocks.list,
  createOrganizationApiToken: mocks.create,
  revokeOrganizationApiToken: mocks.revoke,
}))

import { GET, POST } from '../route'
import { DELETE } from '../[tokenId]/route'

const params = { params: { orgId: 'org-a' } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } } })
  mocks.assertOrgAccess.mockResolvedValue({ ok: true, role: 'admin', orgId: 'org-a' })
})

describe('organization API token routes', () => {
  it('denies non-admins before reading token metadata', async () => {
    mocks.assertOrgAccess.mockResolvedValue({ ok: false })
    const response = await GET(new Request('https://langhub.dev'), params)
    expect(response.status).toBe(403)
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('passes the route organization into the central access gate', async () => {
    mocks.assertOrgAccess.mockResolvedValue({ ok: false })
    await GET(new Request('https://langhub.dev'), { params: { orgId: 'org-b' } })
    expect(mocks.assertOrgAccess).toHaveBeenCalledWith('user-a', 'org-b', 'admin')
  })

  it('lists only safe metadata with a no-store response', async () => {
    mocks.list.mockResolvedValue([{ id: 'token-1', tokenPrefix: 'lh_abc…', name: 'CI', scope: 'read' }])
    const response = await GET(new Request('https://langhub.dev'), params)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(JSON.stringify(body)).not.toContain('token_hash')
    expect(JSON.stringify(body)).not.toContain('tokenHash')
    expect(body.data[0].tokenPrefix).toBe('lh_abc…')
  })

  it('returns a newly created secret once and disables caching', async () => {
    mocks.create.mockResolvedValue({ token: 'lh_secret', metadata: { id: 'token-1', tokenPrefix: 'lh_sec…' } })
    const response = await POST(new Request('https://langhub.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CI', scope: 'read', expiresAt: '2026-08-18T10:00:00.000Z' }),
    }), params)
    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(await response.json()).toMatchObject({ data: { token: 'lh_secret', metadata: { id: 'token-1' } } })
  })

  it('rejects invalid or past expiration before creating a token', async () => {
    const response = await POST(new Request('https://langhub.dev', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CI', scope: 'read', expiresAt: '2020-01-01T00:00:00.000Z' }),
    }), params)
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('revokes only an organization-scoped token ID', async () => {
    mocks.revoke.mockResolvedValue(true)
    const response = await DELETE(new Request('https://langhub.dev', { method: 'DELETE' }), {
      params: { orgId: 'org-a', tokenId: 'token-1' },
    })
    expect(response.status).toBe(200)
    expect(mocks.revoke).toHaveBeenCalledWith('org-a', 'token-1')
  })

  it('does not reveal a cross-org or already-revoked token', async () => {
    mocks.revoke.mockResolvedValue(false)
    const response = await DELETE(new Request('https://langhub.dev', { method: 'DELETE' }), {
      params: { orgId: 'org-a', tokenId: 'token-from-org-b' },
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
  })
})
