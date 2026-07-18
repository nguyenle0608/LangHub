import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getAssistance: vi.fn(), recordUsage: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/translation-assistance/service', () => ({ getTranslationAssistance: mocks.getAssistance, recordSuggestionUsage: mocks.recordUsage }))

import { GET } from '../route'
import { POST as recordUsage } from '../[entryId]/usage/route'

const projectId = '00000000-0000-4000-8000-000000000001'
const branchId = '00000000-0000-4000-8000-000000000002'
const keyId = '00000000-0000-4000-8000-000000000003'
const localeId = '00000000-0000-4000-8000-000000000004'
const params = { params: { projectId } }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TRANSLATION_ASSISTANCE_ENABLED = 'true'
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } } })
  mocks.getAssistance.mockResolvedValue({ sourceText: 'Sign in', sourceLocale: 'en', targetLocale: 'vi', suggestions: [], glossary: [] })
  mocks.recordUsage.mockResolvedValue(true)
})

afterEach(() => { delete process.env.TRANSLATION_ASSISTANCE_ENABLED })

describe('GET project translation assistance', () => {
  it('fails closed while the feature is disabled', async () => {
    delete process.env.TRANSLATION_ASSISTANCE_ENABLED
    const response = await GET(new Request('https://langhub.dev'), params)
    expect(response.status).toBe(404)
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it('requires a verified user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const response = await GET(new Request(`https://langhub.dev?branchId=${branchId}&keyId=${keyId}&localeId=${localeId}`), params)
    expect(response.status).toBe(401)
    expect(mocks.getAssistance).not.toHaveBeenCalled()
  })

  it('rejects malformed resource identifiers', async () => {
    const response = await GET(new Request('https://langhub.dev?branchId=bad&keyId=bad&localeId=bad'), params)
    expect(response.status).toBe(400)
    expect(mocks.getAssistance).not.toHaveBeenCalled()
  })

  it('passes every scoped resource to the central service', async () => {
    const response = await GET(new Request(`https://langhub.dev?branchId=${branchId}&keyId=${keyId}&localeId=${localeId}`), params)
    expect(response.status).toBe(200)
    expect(mocks.getAssistance).toHaveBeenCalledWith({ userId: 'user-a', projectId, branchId, keyId, targetLocaleId: localeId })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('returns generic not found for a cross-resource denial', async () => {
    mocks.getAssistance.mockResolvedValue(null)
    const response = await GET(new Request(`https://langhub.dev?branchId=${branchId}&keyId=${keyId}&localeId=${localeId}`), params)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
  })

  it('keeps lookup failures retryable', async () => {
    mocks.getAssistance.mockRejectedValue(new Error('database failure'))
    const response = await GET(new Request(`https://langhub.dev?branchId=${branchId}&keyId=${keyId}&localeId=${localeId}`), params)
    expect(response.status).toBe(503)
  })

  it('records usage only through a project-scoped service call', async () => {
    const response = await recordUsage(new Request('https://langhub.dev', { method: 'POST' }), {
      params: { projectId, entryId: 'entry-a' },
    })
    expect(response.status).toBe(200)
    expect(mocks.recordUsage).toHaveBeenCalledWith('user-a', projectId, 'entry-a')
  })

  it('hides a cross-organization memory entry during usage recording', async () => {
    mocks.recordUsage.mockResolvedValue(null)
    const response = await recordUsage(new Request('https://langhub.dev', { method: 'POST' }), {
      params: { projectId, entryId: 'entry-from-b' },
    })
    expect(response.status).toBe(404)
  })
})
