import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  existing: null as null | Record<string, unknown>,
  readError: null as null | { message: string },
  reclaim: vi.fn(async () => ({ data: [] as Array<{ token_id: string }>, error: null as null | { message: string } })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const readQuery = {
        select: () => readQuery,
        eq: () => readQuery,
        maybeSingle: async () => ({ data: mocks.existing, error: mocks.readError }),
      }
      const updateQuery = {
        eq: () => updateQuery,
        lt: () => updateQuery,
        select: () => mocks.reclaim(),
      }
      return {
        insert: mocks.insert,
        select: () => readQuery,
        update: () => updateQuery,
      }
    },
  }),
}))

import { hashImportRequest, IDEMPOTENCY_KEY_PATTERN, IN_PROGRESS_STALE_MS, reserveImportIdempotency } from '../idempotency'

const input = { tokenId: 'token-a', key: 'request-123', requestHash: 'a'.repeat(64) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.existing = {
    request_hash: input.requestHash, state: 'in_progress', response_status: null,
    response_body: null, expires_at: '2999-01-01T00:00:00.000Z', updated_at: new Date().toISOString(),
  }
  mocks.readError = null
  mocks.reclaim.mockResolvedValue({ data: [], error: null })
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

  it('reclaims a reservation abandoned by a crashed or timed-out function', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '23505' } })
    mocks.existing = {
      ...mocks.existing!,
      updated_at: new Date(Date.now() - IN_PROGRESS_STALE_MS - 1_000).toISOString(),
    }
    mocks.reclaim.mockResolvedValue({ data: [{ token_id: input.tokenId }], error: null })
    await expect(reserveImportIdempotency(input)).resolves.toEqual({ kind: 'new' })
  })

  it('still reports in_progress when a concurrent retry already reclaimed a stale reservation', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '23505' } })
    mocks.existing = {
      ...mocks.existing!,
      updated_at: new Date(Date.now() - IN_PROGRESS_STALE_MS - 1_000).toISOString(),
    }
    mocks.reclaim.mockResolvedValue({ data: [], error: null })
    await expect(reserveImportIdempotency(input)).resolves.toEqual({ kind: 'conflict', reason: 'in_progress' })
  })

  it('does not reclaim a reservation that is merely recent, not stale', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '23505' } })
    // default mocks.existing.updated_at is "now" — well within the stale window
    await expect(reserveImportIdempotency(input)).resolves.toEqual({ kind: 'conflict', reason: 'in_progress' })
    expect(mocks.reclaim).not.toHaveBeenCalled()
  })
})

