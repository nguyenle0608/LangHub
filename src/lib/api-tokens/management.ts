import { createAdminClient } from '@/lib/supabase/admin'
import type { ApiTokenScope } from './auth'
import { apiTokenDisplayPrefix, generateApiToken, hashApiToken } from './token'

export const MAX_ACTIVE_API_TOKENS = 20

export interface ApiTokenMetadata {
  id: string
  name: string
  tokenPrefix: string
  scope: ApiTokenScope
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  createdBy: string | null
}

export async function listOrganizationApiTokens(orgId: string): Promise<ApiTokenMetadata[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_tokens')
    .select('id, name, token_prefix, scope, last_used_at, expires_at, revoked_at, created_at, created_by')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error('Failed to list API tokens')
  return (data ?? []).map((token) => ({
    id: token.id,
    name: token.name,
    tokenPrefix: token.token_prefix,
    scope: token.scope as ApiTokenScope,
    lastUsedAt: token.last_used_at,
    expiresAt: token.expires_at,
    revokedAt: token.revoked_at,
    createdAt: token.created_at,
    createdBy: token.created_by,
  }))
}

export async function createOrganizationApiToken(input: {
  orgId: string
  userId: string
  name: string
  scope: ApiTokenScope
  expiresAt: string | null
}): Promise<{ token: string; metadata: ApiTokenMetadata } | { error: 'limit' | 'database' }> {
  const admin = createAdminClient()
  const token = generateApiToken()
  const { data: rows, error } = await admin.rpc('create_api_token', {
    p_org_id: input.orgId, p_user_id: input.userId, p_name: input.name,
    p_scope: input.scope, p_expires_at: input.expiresAt,
    p_token_hash: hashApiToken(token), p_token_prefix: apiTokenDisplayPrefix(token),
    p_active_limit: MAX_ACTIVE_API_TOKENS,
  })
  const data = rows?.[0]
  if (error || !data) return { error: error?.message.includes('active_token_limit') ? 'limit' : 'database' }
  return {
    token,
    metadata: {
      id: data.id,
      name: data.name,
      tokenPrefix: data.token_prefix,
      scope: data.scope as ApiTokenScope,
      lastUsedAt: data.last_used_at,
      expiresAt: data.expires_at,
      revokedAt: data.revoked_at,
      createdAt: data.created_at,
      createdBy: data.created_by,
    },
  }
}

export async function revokeOrganizationApiToken(orgId: string, tokenId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('org_id', orgId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()
  return !error && Boolean(data)
}
