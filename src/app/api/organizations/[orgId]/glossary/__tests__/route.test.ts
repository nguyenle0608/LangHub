import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), assertOrgAccess: vi.fn(), from: vi.fn(),
  single: vi.fn(), maybeSingle: vi.fn(), range: vi.fn(), eq: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/auth/access', () => ({ assertOrgAccess: mocks.assertOrgAccess }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mocks.from.mockImplementation(() => {
      const query: Record<string, unknown> = {}
      Object.assign(query, {
        select: vi.fn(() => query), insert: vi.fn(() => query), update: vi.fn(() => query), delete: vi.fn(() => query),
        eq: mocks.eq.mockImplementation(() => query), order: vi.fn(() => query), range: mocks.range,
        single: mocks.single, maybeSingle: mocks.maybeSingle,
      })
      return query
    }),
  }),
}))

import { GET, POST } from '../route'
import { DELETE } from '../[termId]/route'

const params = { params: { orgId: 'org-a' } }
const validTerm = { sourceLocale: 'en', targetLocale: 'vi', sourceTerm: 'Sign in', targetTerm: 'Đăng nhập', caseSensitive: false, wholeWord: true, description: null }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } } })
  mocks.assertOrgAccess.mockResolvedValue({ ok: true, role: 'admin', orgId: 'org-a' })
  mocks.range.mockResolvedValue({ data: [], error: null, count: 0 })
  mocks.single.mockResolvedValue({ data: { id: 'term-a', org_id: 'org-a' }, error: null })
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
})

describe('organization glossary routes', () => {
  it('allows organization members to list with bounded pagination', async () => {
    mocks.assertOrgAccess.mockResolvedValue({ ok: true, role: 'viewer', orgId: 'org-a' })
    const response = await GET(new Request('https://langhub.dev?limit=50&offset=0'), params)
    expect(response.status).toBe(200)
    expect(mocks.assertOrgAccess).toHaveBeenCalledWith('user-a', 'org-a', 'viewer')
    expect(mocks.range).toHaveBeenCalledWith(0, 49)
  })

  it('requires translator+ and denies when the access check fails', async () => {
    mocks.assertOrgAccess.mockResolvedValue({ ok: false })
    const response = await POST(new Request('https://langhub.dev', { method: 'POST', body: JSON.stringify(validTerm) }), params)
    expect(response.status).toBe(403)
    expect(mocks.assertOrgAccess).toHaveBeenCalledWith('user-a', 'org-a', 'translator')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('allows a translator to create a term (in-context capture)', async () => {
    mocks.assertOrgAccess.mockResolvedValue({ ok: true, role: 'translator', orgId: 'org-a' })
    const response = await POST(new Request('https://langhub.dev', { method: 'POST', body: JSON.stringify(validTerm) }), params)
    expect(response.status).toBe(201)
    expect(mocks.assertOrgAccess).toHaveBeenCalledWith('user-a', 'org-a', 'translator')
  })

  it('rejects invalid or identical locale pairs', async () => {
    const response = await POST(new Request('https://langhub.dev', { method: 'POST', body: JSON.stringify({ ...validTerm, targetLocale: 'en' }) }), params)
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns conflict for a normalized duplicate', async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: '23505' } })
    const response = await POST(new Request('https://langhub.dev', { method: 'POST', body: JSON.stringify(validTerm) }), params)
    expect(response.status).toBe(409)
  })

  it('scopes deletion by both term and organization and hides foreign IDs', async () => {
    const response = await DELETE(new Request('https://langhub.dev', { method: 'DELETE' }), { params: { orgId: 'org-a', termId: 'term-from-b' } })
    expect(response.status).toBe(404)
    expect(mocks.eq).toHaveBeenCalledWith('id', 'term-from-b')
    expect(mocks.eq).toHaveBeenCalledWith('org_id', 'org-a')
  })
})
