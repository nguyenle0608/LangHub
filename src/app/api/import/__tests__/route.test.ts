import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { resolveBranchId } from '@/lib/branches/queries'
import { assertBranchAccess, assertLocalesAccess, assertProjectAccess } from '@/lib/auth/access'
import { executeImport } from '@/lib/importers/service'
import { POST } from '../route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/branches/queries', () => ({ resolveBranchId: vi.fn() }))
vi.mock('@/lib/auth/access', () => ({
  assertProjectAccess: vi.fn(),
  assertBranchAccess: vi.fn(),
  assertLocalesAccess: vi.fn(),
}))
vi.mock('@/lib/importers/service', () => ({ executeImport: vi.fn() }))

const projectId = 'project-1'
const branchId = 'branch-main'
const localeId = 'locale-en'

function formRequest(args: {
  filename: string
  content: string
  importStructure?: 'monolithic' | 'namespaced'
}) {
  const fd = new FormData()
  fd.append('file', new File([args.content], args.filename, { type: 'application/json' }))
  fd.append('projectId', projectId)
  fd.append('branchId', branchId)
  fd.append('localeId', localeId)
  fd.append('format', 'json')
  if (args.importStructure) fd.append('importStructure', args.importStructure)
  return { formData: vi.fn().mockResolvedValue(fd) } as unknown as Parameters<typeof POST>[0]
}

describe('POST /api/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    vi.mocked(resolveBranchId).mockResolvedValue(branchId)
    vi.mocked(assertProjectAccess).mockResolvedValue({ ok: true, role: 'translator', projectId, orgId: 'org-1' })
    vi.mocked(assertBranchAccess).mockResolvedValue({ ok: true, role: 'translator', branchId, projectId, orgId: 'org-1' })
    vi.mocked(assertLocalesAccess).mockResolvedValue({ ok: true, role: 'translator', projectId })
    vi.mocked(executeImport).mockResolvedValue({
      created: 0, updated: 1, skipped: 0, total: 1, snapshotId: 'snapshot-1', filename: 'messages.json',
    })
  })

  it('rejects a user who cannot write to the requested project', async () => {
    vi.mocked(assertProjectAccess).mockResolvedValue({ ok: false })

    const response = await POST(formRequest({
      filename: 'messages.json',
      content: JSON.stringify({ title: 'blocked' }),
    }))

    expect(response.status).toBe(403)
    expect(executeImport).not.toHaveBeenCalled()
  })

  it('re-imports one namespaced JSON file into an existing prefixed key', async () => {
    const response = await POST(formRequest({
      filename: 'authen.json',
      content: JSON.stringify({ keya: 'new value' }),
      importStructure: 'namespaced',
    }))

    expect(response.status).toBe(200)
    expect(executeImport).toHaveBeenCalledWith(expect.objectContaining({
      projectId, branchId, localeId,
      entries: [{ key: 'authen.keya', value: 'new value' }],
      actor: { kind: 'user', userId: 'user-1', orgId: 'org-1' },
    }))
    expect(await response.json()).toEqual({
      data: expect.objectContaining({ created: 0, updated: 1, skipped: 0, total: 1 }),
    })
  })

  it('keeps default monolithic JSON import unprefixed', async () => {
    const response = await POST(formRequest({
      filename: 'authen.json',
      content: JSON.stringify({ keya: 'value' }),
    }))

    expect(response.status).toBe(200)
    expect(executeImport).toHaveBeenCalledWith(expect.objectContaining({
      entries: [{ key: 'keya', value: 'value' }],
    }))
  })
})
