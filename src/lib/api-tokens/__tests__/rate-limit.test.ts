import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRateLimitHeaders, consumeApiRateLimit, type ApiRateLimitStore } from '../rate-limit'

afterEach(() => {
  vi.useRealTimers()
})

describe('API rate limiting', () => {
  it('uses separate database-backed read and write quotas', async () => {
    const calls: unknown[][] = []
    const store: ApiRateLimitStore = {
      consume: async (...args) => {
        calls.push(args)
        return { allowed: true, remaining: args[1] === 'read' ? 119 : 9, resetAt: '2026-07-18T10:01:00.000Z' }
      },
    }
    await expect(consumeApiRateLimit('token-1', 'read', store)).resolves.toMatchObject({ limit: 120, remaining: 119 })
    await expect(consumeApiRateLimit('token-1', 'write', store)).resolves.toMatchObject({ limit: 10, remaining: 9 })
    expect(calls).toEqual([
      ['token-1', 'read', 120, 60],
      ['token-1', 'write', 10, 60],
    ])
  })

  it('provides retry guidance when the database denies a request', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T10:00:45.000Z'))
    expect(apiRateLimitHeaders({ allowed: false, limit: 10, remaining: 0, resetAt: '2026-07-18T10:01:00.000Z' })).toEqual({
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': '1784368860',
      'Retry-After': '15',
    })
  })
})
