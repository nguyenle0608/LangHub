import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiToken, isValidApiToken } from './token'

export type ApiTokenScope = 'read' | 'write'

export interface ApiTokenContext {
  tokenId: string
  orgId: string
  scope: ApiTokenScope
  createdBy: string | null
}

export interface StoredApiToken extends ApiTokenContext {
  revokedAt: string | null
  expiresAt: string | null
  lastUsedAt: string | null
}

export interface ApiTokenStore {
  findByHash(hash: string): Promise<StoredApiToken | null>
  touchLastUsed(tokenId: string, usedAt: string): Promise<void>
}

const LAST_USED_THROTTLE_MS = 5 * 60 * 1000

export function readBearerToken(request: Pick<Request, 'headers'>): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization) return null
  const match = /^Bearer ([^\s]+)$/.exec(authorization)
  return match?.[1] ?? null
}

export function createSupabaseApiTokenStore(): ApiTokenStore {
  const admin = createAdminClient()
  return {
    async findByHash(hash) {
      const { data, error } = await admin
        .from('api_tokens')
        .select('id, org_id, scope, created_by, revoked_at, expires_at, last_used_at')
        .eq('token_hash', hash)
        .maybeSingle()
      if (error || !data || (data.scope !== 'read' && data.scope !== 'write')) return null
      return {
        tokenId: data.id,
        orgId: data.org_id,
        scope: data.scope,
        createdBy: data.created_by,
        revokedAt: data.revoked_at,
        expiresAt: data.expires_at,
        lastUsedAt: data.last_used_at,
      }
    },
    async touchLastUsed(tokenId, usedAt) {
      await admin.from('api_tokens').update({ last_used_at: usedAt }).eq('id', tokenId)
    },
  }
}

export async function authenticateApiToken(
  request: Pick<Request, 'headers'>,
  options: { store?: ApiTokenStore; now?: Date } = {}
): Promise<ApiTokenContext | null> {
  const token = readBearerToken(request)
  if (!token || !isValidApiToken(token)) return null

  const now = options.now ?? new Date()
  const store = options.store ?? createSupabaseApiTokenStore()
  const stored = await store.findByHash(hashApiToken(token))
  if (!stored || stored.revokedAt) return null
  if (stored.expiresAt && new Date(stored.expiresAt).getTime() <= now.getTime()) return null

  const lastUsedAt = stored.lastUsedAt ? new Date(stored.lastUsedAt).getTime() : 0
  if (!lastUsedAt || now.getTime() - lastUsedAt >= LAST_USED_THROTTLE_MS) {
    // Usage metadata must never turn a valid API request into an outage.
    await store.touchLastUsed(stored.tokenId, now.toISOString()).catch(() => undefined)
  }

  return {
    tokenId: stored.tokenId,
    orgId: stored.orgId,
    scope: stored.scope,
    createdBy: stored.createdBy,
  }
}

