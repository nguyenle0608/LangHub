import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/

export function hashImportRequest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')
}

export type IdempotencyReservation =
  | { kind: 'new' }
  | { kind: 'replay'; status: number; body: Json }
  | { kind: 'conflict'; reason: 'content_changed' | 'in_progress' | 'previous_failed' | 'expired' }

export async function reserveImportIdempotency(input: {
  tokenId: string; key: string; requestHash: string
}): Promise<IdempotencyReservation> {
  const admin = createAdminClient()
  const { error } = await admin.from('api_idempotency_keys').insert({
    token_id: input.tokenId, idempotency_key: input.key, request_hash: input.requestHash,
  })
  if (!error) return { kind: 'new' }
  if (error.code !== '23505') throw new Error('Failed to reserve idempotency key')

  const { data, error: readError } = await admin
    .from('api_idempotency_keys')
    .select('request_hash, state, response_status, response_body, expires_at')
    .eq('token_id', input.tokenId)
    .eq('idempotency_key', input.key)
    .maybeSingle()
  if (readError || !data) throw new Error('Failed to read idempotency key')
  if (data.request_hash !== input.requestHash) return { kind: 'conflict', reason: 'content_changed' }
  if (data.state === 'completed' && data.response_status && data.response_body !== null) {
    return { kind: 'replay', status: data.response_status, body: data.response_body }
  }
  if (new Date(data.expires_at).getTime() <= Date.now()) return { kind: 'conflict', reason: 'expired' }
  if (data.state === 'failed') return { kind: 'conflict', reason: 'previous_failed' }
  return { kind: 'conflict', reason: 'in_progress' }
}

export async function failImportIdempotency(tokenId: string, key: string) {
  const admin = createAdminClient()
  await admin.from('api_idempotency_keys').update({ state: 'failed', updated_at: new Date().toISOString() })
    .eq('token_id', tokenId).eq('idempotency_key', key).eq('state', 'in_progress')
}
