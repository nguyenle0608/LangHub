import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), assertProjectAccess: vi.fn(), insert: vi.fn(), select: vi.fn(), single: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/auth/access', () => ({ assertProjectAccess: mocks.assertProjectAccess }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const query: Record<string, unknown> = {}
      Object.assign(query, {
        insert: mocks.insert.mockImplementation(() => query),
        select: mocks.select.mockImplementation(() => query),
        single: mocks.single,
      })
      return query
    },
  }),
}))
vi.mock('@/lib/supabase/queries/projects', () => ({
  addLocale: async (_p: string, code: string, name: string) => ({ locale: { id: 'l-1', code, name, is_base: false } }),
}))

import { POST } from '../route'

const params = { params: { projectId: 'proj-a' } }
const post = (body: unknown) => POST(new Request('http://x/api/projects/proj-a/locales', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}), params)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } } })
  mocks.assertProjectAccess.mockResolvedValue({ ok: true, role: 'admin', orgId: 'org-a' })
  mocks.select.mockResolvedValue({ data: [], error: null })
})

describe('adding a language to a project', () => {
  it('stores a code and its name', async () => {
    const res = await post({ code: 'ar-AE', name: 'Arabic (United Arab Emirates)' })
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ locale: { code: 'ar-AE', name: 'Arabic (United Arab Emirates)' } })
  })

  it('canonicalises the code', async () => {
    const res = await post({ code: 'ar_ae', name: 'Arabic (United Arab Emirates)' })
    await expect(res.json()).resolves.toMatchObject({ locale: { code: 'ar-AE' } })
  })

  // A caller that cannot look up a name has been known to send the code as one.
  // Stored, it becomes the language's name on every screen from then on.
  it('refuses a name that is just the code', async () => {
    const res = await post({ code: 'ar-AE', name: 'ar-AE' })
    expect(res.status).toBe(400)
  })

  it('refuses it whatever the case or separator', async () => {
    expect((await post({ code: 'ar-AE', name: ' AR_ae ' })).status).toBe(400)
  })

  it('refuses it inside a bulk add, without adding the rest', async () => {
    const res = await post({ locales: [
      { code: 'ja-JP', name: 'Japanese (Japan)' },
      { code: 'fa-IR', name: 'fa-IR' },
    ] })
    expect(res.status).toBe(400)
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('still accepts a name that merely contains the code', async () => {
    const res = await post({ code: 'ja-JP', name: 'Japanese (ja-JP)' })
    expect(res.status).toBe(201)
  })
})
