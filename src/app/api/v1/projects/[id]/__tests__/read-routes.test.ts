import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), resolveBranch: vi.fn(), resolveLocales: vi.fn(), executeExport: vi.fn(),
  fetchExportData: vi.fn(), lookup: vi.fn(),
}))

vi.mock('@/lib/api-tokens', () => ({
  authorizePublicApiRequest: mocks.authorize,
  publicApiHeaders: () => ({ 'X-Request-ID': 'request-1' }),
  resolveApiBranch: mocks.resolveBranch,
  resolveApiLocales: mocks.resolveLocales,
}))
vi.mock('@/lib/exporters/service', () => ({
  executeExport: mocks.executeExport,
  ExportServiceError: class ExportServiceError extends Error { constructor(public code: string, message: string) { super(message) } },
}))
vi.mock('@/lib/exporters/data', () => ({
  fetchExportData: mocks.fetchExportData,
  buildExportLookup: mocks.lookup,
  ExportDataQueryError: class ExportDataQueryError extends Error {},
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

import { GET as exportGet } from '../export/route'
import { GET as translationsGet } from '../translations/route'

const auth = { ok: true, context: { tokenId: 'token-1', orgId: 'org-a', scope: 'read', createdBy: null }, requestId: 'request-1', rateLimitHeaders: {} }
const params = { params: { id: 'project-a' } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue(auth)
  mocks.resolveBranch.mockResolvedValue('branch-a')
  mocks.resolveLocales.mockResolvedValue([{ id: 'locale-a', code: 'en' }])
  mocks.executeExport.mockResolvedValue({ body: '{}', contentType: 'application/json', filename: 'en.json' })
  mocks.fetchExportData.mockResolvedValue({ keys: [], translations: [] })
  mocks.lookup.mockReturnValue(new Map([['locale-a', { 'z.last': 'Z', 'a.first': 'A' }]]))
})

describe('public project read routes', () => {
  it('rejects a mismatched branch before invoking the exporter', async () => {
    mocks.resolveBranch.mockResolvedValue(null)
    const response = await exportGet(new Request('https://langhub.dev/api/v1/projects/project-a/export?locale=en'), params)
    expect(response.status).toBe(404)
    expect(mocks.executeExport).not.toHaveBeenCalled()
  })

  it('rejects a mismatched locale before invoking the exporter', async () => {
    mocks.resolveLocales.mockResolvedValue(null)
    const response = await exportGet(new Request('https://langhub.dev/api/v1/projects/project-a/export?locale=en'), params)
    expect(response.status).toBe(404)
    expect(mocks.executeExport).not.toHaveBeenCalled()
  })

  it('returns the complete export artifact with safe headers', async () => {
    const response = await exportGet(new Request('https://langhub.dev/api/v1/projects/project-a/export?locale=en&format=json'), params)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="en.json"')
    expect(await response.text()).toBe('{}')
  })

  it('returns deterministic translation keys', async () => {
    const response = await translationsGet(new Request('https://langhub.dev/api/v1/projects/project-a/translations?locale=en'), params)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Object.keys(body.data)).toEqual(['a.first', 'z.last'])
  })

  it('never emits a partial translation payload after a data failure', async () => {
    mocks.fetchExportData.mockRejectedValue(new Error('later page failed'))
    const response = await translationsGet(new Request('https://langhub.dev/api/v1/projects/project-a/translations?locale=en'), params)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.data).toBeUndefined()
  })
})

