import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), resolveBranch: vi.fn(), resolveLocales: vi.fn(),
  parse: vi.fn(), reserve: vi.fn(), fail: vi.fn(), execute: vi.fn(),
}))

vi.mock('@/lib/api-tokens', () => ({
  authorizePublicApiRequest: mocks.authorize,
  publicApiHeaders: () => ({ 'X-Request-ID': '00000000-0000-4000-8000-000000000010' }),
  resolveApiBranch: mocks.resolveBranch,
  resolveApiLocales: mocks.resolveLocales,
}))
vi.mock('@/lib/importers/idempotency', () => ({
  IDEMPOTENCY_KEY_PATTERN: /^[A-Za-z0-9._:-]{8,200}$/,
  hashImportRequest: () => 'a'.repeat(64),
  reserveImportIdempotency: mocks.reserve,
  failImportIdempotency: mocks.fail,
}))
vi.mock('@/lib/importers/parse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/importers/parse')>()),
  parseImportContent: mocks.parse,
}))
vi.mock('@/lib/importers/service', () => ({ executeImport: mocks.execute }))

import { POST } from '../route'

const auth = { ok: true, context: { tokenId: 'token-a', orgId: 'org-a', scope: 'write', createdBy: 'user-a' }, requestId: '00000000-0000-4000-8000-000000000010', rateLimitHeaders: {} }
const params = { params: { id: 'project-a' } }

function request(options: { idempotencyKey?: string; contentLength?: number } = {}) {
  const form = new FormData()
  form.set('file', new File(['{"hello":"world"}'], 'en.json', { type: 'application/json' }))
  form.set('locale', 'en')
  form.set('format', 'json')
  return {
    headers: new Headers({
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      'Content-Length': String(options.contentLength ?? 1000),
    }),
    formData: async () => form,
  } as Request
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue(auth)
  mocks.resolveBranch.mockResolvedValue('branch-a')
  mocks.resolveLocales.mockResolvedValue([{ id: 'locale-a', code: 'en' }])
  mocks.parse.mockReturnValue({ entries: [{ key: 'hello', value: 'world' }], warnings: [] })
  mocks.reserve.mockResolvedValue({ kind: 'new' })
  mocks.execute.mockResolvedValue({ created: 1, updated: 0, skipped: 0, total: 1, snapshotId: 'snapshot-a', filename: 'en.json' })
  mocks.fail.mockResolvedValue(undefined)
})

describe('POST /api/v1/projects/:id/import', () => {
  it('rejects a missing idempotency key before parsing the body', async () => {
    const response = await POST(request(), params)
    expect(response.status).toBe(400)
    expect(mocks.parse).not.toHaveBeenCalled()
  })

  it('rejects an oversized body before multipart parsing or snapshot', async () => {
    const response = await POST(request({ idempotencyKey: 'request-123', contentLength: 5 * 1024 * 1024 + 1 }), params)
    expect(response.status).toBe(413)
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('replays a completed request without snapshot or mutation', async () => {
    mocks.reserve.mockResolvedValue({ kind: 'replay', status: 200, body: { data: { created: 1 } } })
    const response = await POST(request({ idempotencyKey: 'request-123' }), params)
    expect(response.status).toBe(200)
    expect(response.headers.get('idempotent-replayed')).toBe('true')
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it.each(['content_changed', 'in_progress'])('returns conflict for %s idempotency reuse', async (reason) => {
    mocks.reserve.mockResolvedValue({ kind: 'conflict', reason })
    const response = await POST(request({ idempotencyKey: 'request-123' }), params)
    expect(response.status).toBe(409)
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('passes the reservation identity into the atomic import service', async () => {
    const response = await POST(request({ idempotencyKey: 'request-123' }), params)
    expect(response.status).toBe(200)
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-a', branchId: 'branch-a', localeId: 'locale-a',
      idempotency: { key: 'request-123', requestHash: 'a'.repeat(64) },
      actor: expect.objectContaining({ kind: 'api_token', requestId: auth.requestId }),
    }))
  })

  it('marks a reserved request failed if snapshot or transaction work fails', async () => {
    mocks.execute.mockRejectedValue(new Error('Snapshot failed'))
    const response = await POST(request({ idempotencyKey: 'request-123' }), params)
    expect(response.status).toBe(500)
    expect(mocks.fail).toHaveBeenCalledWith('token-a', 'request-123')
    expect((await response.json()).data).toBeUndefined()
  })
})
