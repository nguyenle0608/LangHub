import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveBranchId } from '@/lib/branches/queries'
import { createSnapshot } from '@/lib/versions/snapshot'
import { POST } from '../route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/branches/queries', () => ({ resolveBranchId: vi.fn() }))
vi.mock('@/lib/versions/snapshot', () => ({ createSnapshot: vi.fn() }))

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

function mockAdmin(existingKeys: Array<{ id: string; key: string }>) {
  const insertedKeys: Array<{ project_id: string; branch_id: string; key: string; created_by: string }> = []
  const upsertedTranslations: Array<{ key_id: string; value: string }> = []

  const admin = {
    from(table: string) {
      if (table === 'translation_keys') {
        return {
          select: () => ({
            eq: () => ({ data: existingKeys }),
          }),
          insert: (rows: typeof insertedKeys) => {
            insertedKeys.push(...rows)
            return {
              select: () => ({
                data: rows.map((row, index) => ({
                  id: `inserted-${index}`,
                  key: row.key,
                })),
              }),
            }
          },
        }
      }

      if (table === 'locales') {
        return {
          select: () => ({
            eq: () => ({ data: [{ id: localeId }] }),
          }),
        }
      }

      if (table === 'translations') {
        return {
          insert: () => ({ data: null, error: null }),
          upsert: (rows: Array<{ key_id: string; value: string }>) => {
            upsertedTranslations.push(...rows)
            return {
              select: () => ({
                data: rows.map((_, index) => ({ id: `translation-${index}` })),
              }),
            }
          },
        }
      }

      if (table === 'translation_history') {
        return {
          insert: () => ({ data: null, error: null }),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  } as unknown as ReturnType<typeof createAdminClient>

  vi.mocked(createAdminClient).mockReturnValue(admin)
  return { insertedKeys, upsertedTranslations }
}

describe('POST /api/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    vi.mocked(resolveBranchId).mockResolvedValue(branchId)
    vi.mocked(createSnapshot).mockResolvedValue({ id: 'snapshot-1' } as Awaited<ReturnType<typeof createSnapshot>>)
  })

  it('re-imports one namespaced JSON file into an existing prefixed key', async () => {
    const { insertedKeys, upsertedTranslations } = mockAdmin([
      { id: 'key-authen-keyA', key: 'authen.keyA' },
    ])

    const response = await POST(formRequest({
      filename: 'authen.json',
      content: JSON.stringify({ keyA: 'new value' }),
      importStructure: 'namespaced',
    }))

    expect(response.status).toBe(200)
    expect(insertedKeys).toEqual([])
    expect(upsertedTranslations).toEqual([
      expect.objectContaining({ key_id: 'key-authen-keyA', value: 'new value' }),
    ])
    expect(await response.json()).toEqual({
      data: expect.objectContaining({ created: 0, updated: 1, skipped: 0, total: 1 }),
    })
  })

  it('keeps default monolithic JSON import unprefixed', async () => {
    const { insertedKeys, upsertedTranslations } = mockAdmin([])

    const response = await POST(formRequest({
      filename: 'authen.json',
      content: JSON.stringify({ keyA: 'value' }),
    }))

    expect(response.status).toBe(200)
    expect(insertedKeys.map((row) => row.key)).toEqual(['keyA'])
    expect(upsertedTranslations).toEqual([
      expect.objectContaining({ key_id: 'inserted-0', value: 'value' }),
    ])
  })
})
