import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), assertOrgAccess: vi.fn(),
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/auth/access', () => ({ assertOrgAccess: mocks.assertOrgAccess }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mocks.from.mockImplementation(() => {
      const query: Record<string, unknown> = {}
      Object.assign(query, {
        select: mocks.select.mockImplementation(() => query),
        eq: mocks.eq.mockImplementation(() => query),
        order: mocks.order.mockImplementation(() => query),
        range: mocks.range,
      })
      return query
    }),
  }),
}))

const params = { params: { orgId: 'org-a' } }
const termRow = {
  source_locale: 'en', target_locale: 'vi', source_term: 'Sign in', target_term: 'Đăng nhập',
  case_sensitive: false, whole_word: true, description: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } } })
  mocks.assertOrgAccess.mockResolvedValue({ ok: true, role: 'viewer', orgId: 'org-a' })
  mocks.range.mockResolvedValue({ data: [termRow], error: null })
})

describe('GET /api/organizations/[orgId]/glossary/export', () => {
  it('requires viewer+ and denies otherwise', async () => {
    mocks.assertOrgAccess.mockResolvedValue({ ok: false })
    const response = await GET(new Request('https://langhub.dev'), params)
    expect(response.status).toBe(403)
    expect(mocks.assertOrgAccess).toHaveBeenCalledWith('user-a', 'org-a', 'viewer')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a downloadable CSV with the expected columns', async () => {
    const response = await GET(new Request('https://langhub.dev'), params)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('glossary.csv')
    const body = await response.text()
    expect(body).toBe('source_locale,target_locale,source_term,target_term,case_sensitive,whole_word,description\nen,vi,Sign in,Đăng nhập,false,true,')
  })

  it('applies sourceLocale/targetLocale filters from the query string', async () => {
    await GET(new Request('https://langhub.dev?sourceLocale=EN&targetLocale=vi'), params)
    expect(mocks.eq).toHaveBeenCalledWith('org_id', 'org-a')
    expect(mocks.eq).toHaveBeenCalledWith('source_locale', 'en')
    expect(mocks.eq).toHaveBeenCalledWith('target_locale', 'vi')
  })

  it('paginates through every page via loadAllPages', async () => {
    mocks.range
      .mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => termRow), error: null })
      .mockResolvedValueOnce({ data: [termRow], error: null })
    const response = await GET(new Request('https://langhub.dev'), params)
    expect(response.status).toBe(200)
    expect(mocks.range).toHaveBeenCalledTimes(2)
    const body = await response.text()
    expect(body.trim().split('\n')).toHaveLength(1 + 501) // header + 501 data rows
  })

  it('surfaces a database error as a 500', async () => {
    mocks.range.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const response = await GET(new Request('https://langhub.dev'), params)
    expect(response.status).toBe(500)
  })
})
