import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveBranchId } from '@/lib/branches/queries'
import { ExportDataQueryError, fetchExportData } from '@/lib/exporters/data'
import { exportZIP } from '@/lib/exporters/zip'
import { POST } from '../route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/branches/queries', () => ({ resolveBranchId: vi.fn() }))
vi.mock('@/lib/exporters/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/exporters/data')>()
  return { ...actual, fetchExportData: vi.fn() }
})
vi.mock('@/lib/exporters/zip', () => ({ exportZIP: vi.fn() }))

const projectId = 'project-1'
const en = { id: 'locale-en', code: 'en', name: 'English' }
const viLocale = { id: 'locale-vi', code: 'vi', name: 'Tiếng Việt' }

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      branchId: 'branch-main',
      localeIds: [en.id],
      format: 'json',
      filter: 'all',
      nested: true,
      ...body,
    }),
  })
}

function mockLocales(locales = [en]) {
  const query = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: locales, error: null }),
  }
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn().mockReturnValue(query),
  } as unknown as ReturnType<typeof createAdminClient>)
}

describe('POST /api/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    vi.mocked(resolveBranchId).mockResolvedValue('branch-main')
    mockLocales()
  })

  it('returns a complete nested JSON file for a populated locale', async () => {
    vi.mocked(fetchExportData).mockResolvedValue({
      keys: [{ id: 'key-title', key: 'app.title', description: null }],
      translations: [{
        key_id: 'key-title', locale_id: en.id, value: 'LangHub', status: 'pending',
      }],
    })

    const response = await POST(request({}))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('filename="en.json"')
    expect(JSON.parse(await response.text())).toEqual({ app: { title: 'LangHub' } })
  })

  it('keeps a successfully queried empty locale as a valid empty JSON file', async () => {
    vi.mocked(fetchExportData).mockResolvedValue({
      keys: [{ id: 'key-title', key: 'app.title', description: null }],
      translations: [],
    })

    const response = await POST(request({}))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{}')
  })

  it('returns an error response instead of a file when export data retrieval fails', async () => {
    vi.mocked(fetchExportData).mockRejectedValue(
      new ExportDataQueryError('translations', 'request URI too large')
    )

    const response = await POST(request({}))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Failed to load translations for export: request URI too large',
    })
    expect(response.headers.get('Content-Disposition')).toBeNull()
  })

  it('preserves one file per selected locale for multi-locale ZIP export', async () => {
    mockLocales([en, viLocale])
    vi.mocked(fetchExportData).mockResolvedValue({
      keys: [{ id: 'key-title', key: 'app.title', description: null }],
      translations: [
        { key_id: 'key-title', locale_id: en.id, value: 'Title', status: 'approved' },
        { key_id: 'key-title', locale_id: viLocale.id, value: 'Tiêu đề', status: 'approved' },
      ],
    })
    vi.mocked(exportZIP).mockResolvedValue(Buffer.from([1, 2, 3]))

    const response = await POST(request({ localeIds: [en.id, viLocale.id] }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('filename="translations.zip"')
    expect(exportZIP).toHaveBeenCalledWith([
      { name: 'en.json', content: '{\n  "app": {\n    "title": "Title"\n  }\n}' },
      { name: 'vi.json', content: '{\n  "app": {\n    "title": "Tiêu đề"\n  }\n}' },
    ])
  })

  it('surfaces locale query errors', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: { message: 'locale lookup failed' } }),
    }
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createAdminClient>)
    vi.mocked(fetchExportData).mockResolvedValue({
      keys: [{ id: 'key-title', key: 'app.title', description: null }],
      translations: [],
    })

    const response = await POST(request({}))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Failed to load locales for export: locale lookup failed',
    })
  })
})
