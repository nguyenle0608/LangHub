import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ApiTokenContext } from './auth'
import { assertApiProjectAccess } from './access'

const UUID = z.string().uuid()

export async function resolveApiBranch(
  context: ApiTokenContext,
  projectId: string,
  branchRef?: string | null
): Promise<string | null> {
  if (!(await assertApiProjectAccess(context, projectId))) return null
  const admin = createAdminClient()
  let query = admin.from('branches').select('id').eq('project_id', projectId)
  query = branchRef
    ? (UUID.safeParse(branchRef).success ? query.eq('id', branchRef) : query.eq('name', branchRef))
    : query.eq('is_default', true)
  const { data, error } = await query.maybeSingle()
  return error ? null : data?.id ?? null
}

export async function resolveApiLocales(
  context: ApiTokenContext,
  projectId: string,
  localeRefs: string[]
): Promise<Array<{ id: string; code: string }> | null> {
  if (!(await assertApiProjectAccess(context, projectId)) || localeRefs.length === 0) return null
  const admin = createAdminClient()
  const refs = Array.from(new Set(localeRefs))
  const ids = refs.filter((ref) => UUID.safeParse(ref).success)
  const codes = refs.filter((ref) => !UUID.safeParse(ref).success)
  const [idResult, codeResult] = await Promise.all([
    ids.length
      ? admin.from('locales').select('id, code').eq('project_id', projectId).in('id', ids)
      : Promise.resolve({ data: [], error: null }),
    codes.length
      ? admin.from('locales').select('id, code').eq('project_id', projectId).in('code', codes)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (idResult.error || codeResult.error) return null
  const rows = [...(idResult.data ?? []), ...(codeResult.data ?? [])]
  const byId = new Map(rows.map((locale) => [locale.id, locale]))
  const byCode = new Map(rows.map((locale) => [locale.code, locale]))
  const result = refs.map((ref) => UUID.safeParse(ref).success ? byId.get(ref) : byCode.get(ref))
  return result.every((locale): locale is { id: string; code: string } => Boolean(locale)) ? result : null
}
