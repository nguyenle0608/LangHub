import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type BranchTranslation = {
  key_id: string | null
  locale_id: string | null
  value: string | null
  status: string | null
}

/**
 * Fetch ALL translation rows for a branch, paginated.
 *
 * Scoping by `branch_id` (instead of `.in('key_id', [...hundreds])`) avoids
 * PostgREST "Bad Request" from over-long URLs, and `.range()` pagination
 * bypasses the 1000-row default cap. Works with either the user-scoped or
 * admin Supabase client.
 */
export async function fetchBranchTranslations(
  client: SupabaseClient<Database>,
  branchId: string
): Promise<BranchTranslation[]> {
  const out: BranchTranslation[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await client
      .from('translations')
      .select('key_id, locale_id, value, status')
      .eq('branch_id', branchId)
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}
