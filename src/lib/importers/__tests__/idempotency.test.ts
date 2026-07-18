import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ insert: vi.fn(), existing: null as null | Record<string, unknown>, readError: null as null | { message: string } }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const query = {
        insert: mocks.insert,
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: mocks.existing, error: mocks.readError }),
        update: () => query,
      }
      return query
    },
  }),
}))

import { hashImportRequest, IDEMPOTENCY_KEY_PATTERN, reserveImportIdempotency } from '../idempotency'

const input = { tokenId: 'token-a', key: 'request-123', requestHash: 'a'.repeat(64) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.existing = {
    request_hash: input.requestHash, state: 'in_progress', response_status: null,
    response_body: null, expires_at: '2999-01-01T00:00:00.000Z',
  }
  mocks.readError = null
})

describe('import idempotency', () => {
  it('normalizes request hashes and validates safe client keys', () => {
    expect(hashImportRequest({ a: 1 })).toMatch(/^[0-9a-f]{64}$/)
    expect(hashImportRequest({ a: 1 })).toBe(hashImportRequest({ a: 1 }))
    expect(IDEMPOTENCY_KEY_PATTERN.test('request-123')).toBe(true)
    expect(IDEMPOTENCY_KEY_PATTERN.test('short')).toBe(false)
  })

  it('reserves the first request and rejects a concurrent duplicate', async () => {
    mocks.insert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: '23505' } })
    const [first, second] = await Promise.all([
      reserveImportIdempotency(input), reserveImportIdempotency(input),
    ])
    expect(first).toEqual({ kind: 'new' })
    expect(second).toEqual({ kind: 'conflict', reason: 'in_progress' })
  })

  it('replays a stored completed response', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '23505' } })
    mocks.existing = { ...mocks.existing!, state: 'completed', response_status: 200, response_body: { data: { created: 1 } } }
    await expect(reserveImportIdempotency(input)).resolves.toEqual({ kind: 'replay', status: 200, body: { data: { created: 1 } } })
  })

  it('rejects reuse with changed content', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '23505' } })
    mocks.existing = { ...mocks.existing!, request_hash: 'b'.repeat(64) }
    await expect(reserveImportIdempotency(input)).resolves.toEqual({ kind: 'conflict', reason: 'content_changed' })
  })
})

