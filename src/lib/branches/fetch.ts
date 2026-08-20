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
 * bypasses the 1000-row default cap. Ordered by primary key so the pages do
 * not overlap. Works with either the user-scoped or admin Supabase client.
 */
export async function fetchBranchTranslations(
  client: SupabaseClient<Database>,
  branchId: string,
  options: { throwOnError?: boolean } = {}
): Promise<BranchTranslation[]> {
  const out: BranchTranslation[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await client
      .from('translations')
      .select('key_id, locale_id, value, status')
      .eq('branch_id', branchId)
      // Ordering is what makes the paging deterministic. Without it Postgres is
      // free to return rows in any order per page, so pages could overlap or
      // skip — which surfaced as a duplicate (key_id, locale_id) pair crashing
      // a snapshot insert once a fork had changed the table's layout.
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      if (options.throwOnError) throw new Error(`Failed to load branch translations: ${error.message}`)
      break
    }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}
