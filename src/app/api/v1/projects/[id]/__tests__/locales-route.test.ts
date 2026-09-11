import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  assertProjectAccess: vi.fn(),
  rows: vi.fn(),
}))

vi.mock('@/lib/api-tokens', () => ({
  authorizePublicApiRequest: mocks.authorize,
  publicApiHeaders: () => ({ 'X-Request-ID': 'request-1' }),
}))
vi.mock('@/lib/api-tokens/access', () => ({ assertApiProjectAccess: mocks.assertProjectAccess }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ order: () => mocks.rows() }) }),
    }),
  }),
}))

import { GET } from '../locales/route'

const auth = {
  ok: true,
  context: { tokenId: 'token-1', orgId: 'org-a', scope: 'read', createdBy: null },
  requestId: 'request-1',
  rateLimitHeaders: {},
}
const params = { params: { id: 'project-a' } }
const request = new Request('http://localhost/api/v1/projects/project-a/locales')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue(auth)
  mocks.assertProjectAccess.mockResolvedValue(true)
  mocks.rows.mockResolvedValue({
    data: [
      { code: 'en-US', name: 'English (United States)', is_base: true },
      { code: 'vi-VN', name: 'Vietnamese (Vietnam)', is_base: null },
    ],
    error: null,
  })
})

describe('GET /api/v1/projects/:id/locales', () => {
  it('lists the codes a caller can then ask for', async () => {
    // The reason this route exists: every other v1 route takes a locale and
    // answers 404 when it is wrong, so without this there is no way to find out
    // what to ask for, and a locale typo looks like a wrong project id.
    const response = await GET(request, params)
    const body = await response.json() as { data: Array<{ code: string; isBase: boolean }> }

    expect(response.status).toBe(200)
    expect(body.data).toEqual([
      { code: 'en-US', name: 'English (United States)', isBase: true },
      { code: 'vi-VN', name: 'Vietnamese (Vietnam)', isBase: false },
    ])
  })

  it('reads a null is_base as false rather than passing it through', async () => {
    const response = await GET(request, params)
    const body = await response.json() as { data: Array<{ isBase: boolean }> }
    expect(body.data[1]!.isBase).toBe(false)
  })

  it('requires a token', async () => {
    mocks.authorize.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) })
    expect((await GET(request, params)).status).toBe(401)
  })

  it('answers 404 for a project outside the token workspace', async () => {
    // Not 403: telling an unauthorized caller that a project exists is how a
    // workspace gets enumerated.
    mocks.assertProjectAccess.mockResolvedValue(false)
    expect((await GET(request, params)).status).toBe(404)
  })

  it('does not leak a database error as a 200 with no locales', async () => {
    mocks.rows.mockResolvedValue({ data: null, error: { message: 'connection lost' } })
    expect((await GET(request, params)).status).toBe(500)
  })
})
