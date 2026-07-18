import { createAdminClient } from '@/lib/supabase/admin'

export type ApiRequestKind = 'read' | 'write'

export interface ApiRateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: string
  limit: number
}

export interface ApiRateLimitStore {
  consume(tokenId: string, kind: ApiRequestKind, limit: number, windowSeconds: number): Promise<Omit<ApiRateLimitResult, 'limit'> | null>
}

export const API_RATE_LIMITS: Record<ApiRequestKind, number> = { read: 120, write: 10 }
export const API_RATE_LIMIT_WINDOW_SECONDS = 60

export function createSupabaseApiRateLimitStore(): ApiRateLimitStore {
  const admin = createAdminClient()
  return {
    async consume(tokenId, kind, limit, windowSeconds) {
      const { data, error } = await admin.rpc('consume_api_rate_limit', {
        p_token_id: tokenId,
        p_request_kind: kind,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      })
      const row = data?.[0]
      return error || !row
        ? null
        : { allowed: row.allowed, remaining: row.remaining, resetAt: row.reset_at }
    },
  }
}

export async function consumeApiRateLimit(
  tokenId: string,
  kind: ApiRequestKind,
  store: ApiRateLimitStore = createSupabaseApiRateLimitStore()
): Promise<ApiRateLimitResult | null> {
  const limit = API_RATE_LIMITS[kind]
  const result = await store.consume(tokenId, kind, limit, API_RATE_LIMIT_WINDOW_SECONDS)
  return result ? { ...result, limit } : null
}

export function apiRateLimitHeaders(result: ApiRateLimitResult): Record<string, string> {
  const resetSeconds = Math.max(0, Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000))
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(new Date(result.resetAt).getTime() / 1000)),
    ...(result.allowed ? {} : { 'Retry-After': String(resetSeconds) }),
  }
}

