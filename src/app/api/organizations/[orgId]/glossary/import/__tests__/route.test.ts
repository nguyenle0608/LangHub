import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), assertOrgAccess: vi.fn(),
  from: vi.fn(), upsert: vi.fn(), select: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/auth/access', () => ({ assertOrgAccess: mocks.assertOrgAccess }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mocks.from.mockImplementation(() => ({
      upsert: mocks.upsert.mockImplementation(() => ({ select: mocks.select })),
    })),
  }),
}))

const params = { params: { orgId: 'org-a' } }

function formRequest(content: string, filename = 'terms.csv') {
  const fd = new FormData()
  fd.append('file', new File([content], filename, { type: 'text/csv' }))
  return { formData: vi.fn().mockResolvedValue(fd) } as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } } })
  mocks.assertOrgAccess.mockResolvedValue({ ok: true, role: 'admin', orgId: 'org-a' })
  mocks.select.mockResolvedValue({ data: [{ id: 'term-1' }], error: null })
})

describe('POST /api/organizations/[orgId]/glossary/import', () => {
  it('requires admin+ and denies otherwise', async () => {
    mocks.assertOrgAccess.mockResolvedValue({ ok: false })
    const response = await POST(formRequest('source_locale,target_locale,source_term,target_term\nen,vi,Sign in,Đăng nhập'), params)
    expect(response.status).toBe(403)
    expect(mocks.assertOrgAccess).toHaveBeenCalledWith('user-a', 'org-a', 'admin')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a file', async () => {
    const response = await POST({ formData: vi.fn().mockResolvedValue(new FormData()) } as unknown as Parameters<typeof POST>[0], params)
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a CSV missing required columns before touching the database', async () => {
    const response = await POST(formRequest('source_locale,target_locale\nen,vi'), params)
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('imports valid rows and reports created/skipped counts plus row errors', async () => {
    mocks.select.mockResolvedValue({ data: [{ id: 'term-1' }], error: null }) // 1 of 2 rows actually inserted
    const csv = [
      'source_locale,target_locale,source_term,target_term',
      'en,vi,Sign in,Đăng nhập',
      'en,vi,Workspace,Không gian làm việc',
      'en,vi,,Missing source term',
    ].join('\n')
    const response = await POST(formRequest(csv), params)
    expect(response.status).toBe(200)
    const body = await response.json() as { data: { totalRows: number; created: number; skipped: number; errors: string[] } }
    expect(body.data.totalRows).toBe(2)
    expect(body.data.created).toBe(1)
    expect(body.data.skipped).toBe(1)
    expect(body.data.errors).toEqual(['Row 4: source_locale, target_locale, source_term, and target_term are all required'])
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ org_id: 'org-a', source_term: 'Sign in', target_term: 'Đăng nhập' })]),
      { onConflict: 'org_id,source_locale,target_locale,source_normalized', ignoreDuplicates: true }
    )
  })

  it('surfaces a database error as a 500', async () => {
    mocks.select.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const response = await POST(formRequest('source_locale,target_locale,source_term,target_term\nen,vi,Sign in,Đăng nhập'), params)
    expect(response.status).toBe(500)
  })
})
