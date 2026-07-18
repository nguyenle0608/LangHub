import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), decode: vi.fn(), encode: vi.fn(), rows: [] as Array<Record<string, unknown>>, error: null as null | { message: string } }))

vi.mock('@/lib/api-tokens', () => ({
  authorizePublicApiRequest: mocks.authorize,
  decodeProjectCursor: mocks.decode,
  encodeProjectCursor: mocks.encode,
  publicApiHeaders: () => ({ 'X-Request-ID': 'request-1' }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query, gt: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: mocks.rows, error: mocks.error })),
      }
      return query
    },
  }),
}))

import { GET } from '../route'

const auth = { ok: true, context: { tokenId: 'token-1', orgId: '00000000-0000-4000-8000-000000000001', scope: 'read', createdBy: null }, requestId: 'request-1', rateLimitHeaders: {} }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue(auth)
  mocks.decode.mockReturnValue({ id: '00000000-0000-4000-8000-000000000010' })
  mocks.encode.mockReturnValue('next-cursor')
  mocks.error = null
  mocks.rows = []
})

describe('GET /api/v1/projects', () => {
  it('returns a bounded deterministic page and next cursor', async () => {
    mocks.rows = [
      { id: 'p1', name: 'One', slug: 'one', description: null, base_locale: 'en', created_at: null },
      { id: 'p2', name: 'Two', slug: 'two', description: null, base_locale: 'en', created_at: null },
    ]
    const response = await GET(new Request('https://langhub.dev/api/v1/projects?limit=1'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: [{ id: 'p1' }], pagination: { nextCursor: 'next-cursor' } })
  })

  it('rejects malformed or out-of-scope cursors without querying projects', async () => {
    mocks.decode.mockReturnValue(null)
    const response = await GET(new Request('https://langhub.dev/api/v1/projects?cursor=foreign'))
    expect(response.status).toBe(400)
    expect(mocks.encode).not.toHaveBeenCalled()
  })

  it('does not return a partial page on query failure', async () => {
    mocks.rows = [{ id: 'p1' }]
    mocks.error = { message: 'database failure' }
    const response = await GET(new Request('https://langhub.dev/api/v1/projects'))
    expect(response.status).toBe(500)
  })
})

