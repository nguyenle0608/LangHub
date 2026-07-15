import { createClient } from '../server'
import { createAdminClient } from '../admin'
import type { Database } from '@/types/database'

type TranslationRow = Database['public']['Tables']['translations']['Row']
type KeyRow = Database['public']['Tables']['translation_keys']['Row']

// The grid only needs these 5 of the 12 translation columns. Shipping the
// full row (ai_*, reviewed_by, translated_by, updated_at, branch_id) is dead
// weight — ~50%+ of the editor payload, multiplied per locale per key.
export type GridTranslation = Pick<TranslationRow, 'id' | 'key_id' | 'locale_id' | 'value' | 'status'>
const GRID_TRANSLATION_COLS = 'id, key_id, locale_id, value, status'

export type KeyWithTranslations = KeyRow & { translations: GridTranslation[] }

// ── Reads: user-scoped client (RLS applies) ───────────────────────────────

const PAGE_SIZE = 1000

// Count keys on a branch — cheap, used to drive windowed loading in the editor.
export async function getTranslationKeyCount(projectId: string, branchId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('translation_keys')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('branch_id', branchId)
  return count ?? 0
}

export async function getTranslationKeysPage(
  projectId: string,
  branchId: string,
  opts: { afterKey?: string; limit: number; includeCount?: boolean }
): Promise<{ keys: KeyWithTranslations[]; total?: number }> {
  const supabase = await createClient()

  if (opts.includeCount) {
    let q = supabase
      .from('translation_keys')
      .select(`*, translations(${GRID_TRANSLATION_COLS})`, { count: 'exact' })
      .eq('project_id', projectId)
      .eq('branch_id', branchId)
      .eq('translations.branch_id', branchId)
      .order('key', { ascending: true })
      .limit(opts.limit)
    if (opts.afterKey !== undefined) q = q.gt('key', opts.afterKey)
    const { data, count } = await q
    return { keys: (data ?? []) as KeyWithTranslations[], total: count ?? undefined }
  }

  let q = supabase
    .from('translation_keys')
    .select(`*, translations(${GRID_TRANSLATION_COLS})`)
    .eq('project_id', projectId)
    .eq('branch_id', branchId)
    .eq('translations.branch_id', branchId)
    .order('key', { ascending: true })
    .limit(opts.limit)
  if (opts.afterKey !== undefined) q = q.gt('key', opts.afterKey)
  const { data } = await q
  return { keys: (data ?? []) as KeyWithTranslations[] }
}

export async function getTranslationKeys(
  projectId: string,
  branchId: string,
  // Windowed mode is keyset/cursor-based: pass `limit` and the previous page's
  // last key as `afterKey`. Keys are unique + non-null + indexed per branch,
  // so this is drift-safe (no skip/duplicate when rows change mid-stream) and
  // has constant cost regardless of how deep we are.
  opts?: { search?: string; status?: string; tags?: string[]; afterKey?: string; limit?: number }
): Promise<KeyWithTranslations[]> {
  const supabase = await createClient()

  const baseQuery = () =>
    supabase
      .from('translation_keys')
      // Keys are per-branch (M2); translations are embedded and also branch-scoped.
      .select(`*, translations(${GRID_TRANSLATION_COLS})`)
      .eq('project_id', projectId)
      .eq('branch_id', branchId)
      .eq('translations.branch_id', branchId)
      .order('key', { ascending: true })

  // Windowed mode: fetch a single page after the cursor (no client-side
  // filtering — the editor filters in memory once all pages stream in).
  if (opts?.limit !== undefined) {
    const { keys } = await getTranslationKeysPage(projectId, branchId, {
      afterKey: opts.afterKey,
      limit: opts.limit,
    })
    return keys
  }

  // Full mode: paginate to bypass PostgREST's 1000-row default limit.
  const all: KeyWithTranslations[] = []
  let offset = 0
  while (true) {
    const { data, error } = await baseQuery().range(offset, offset + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all.push(...(data as KeyWithTranslations[]))
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  let keys = all

  if (opts?.search) {
    const q = opts.search.toLowerCase()
    keys = keys.filter(
      (k) =>
        k.key.toLowerCase().includes(q) ||
        (k.description ?? '').toLowerCase().includes(q) ||
        k.translations.some((t) => (t.value ?? '').toLowerCase().includes(q))
    )
  }

  if (opts?.tags?.length) {
    const required = opts.tags
    keys = keys.filter((k) => required.every((tag) => (k.tags ?? []).includes(tag)))
  }

  if (opts?.status && opts.status !== 'all') {
    const s = opts.status
    if (s === 'empty') {
      keys = keys.filter((k) => k.translations.some((t) => !t.value || t.status === 'empty'))
    } else {
      keys = keys.filter((k) => k.translations.some((t) => t.status === s))
    }
  }

  return keys
}

export async function getTranslationHistoryForKey(keyId: string) {
  const supabase = await createClient()

  const { data: translations } = await supabase
    .from('translations')
    .select('id, locale_id, locales(code, name)')
    .eq('key_id', keyId)

  if (!translations?.length) return []

  const translationIds = translations.map((t) => t.id)

  const { data: history } = await supabase
    .from('translation_history')
    .select('*')
    .in('translation_id', translationIds)
    .order('changed_at', { ascending: false })
    .limit(100)

  if (!history) return []

  const localeByTranslationId = Object.fromEntries(
    translations.map((t) => [
      t.id,
      Array.isArray(t.locales)
        ? (t.locales[0] ?? { code: '?', name: '?' })
        : (t.locales ?? { code: '?', name: '?' }),
    ])
  )

  return history.map((h) => ({
    ...h,
    locale: localeByTranslationId[h.translation_id ?? ''] ?? { code: '?', name: '?' },
  }))
}

// ── Writes: admin client (service role) ──────────────────────────────────

export async function updateTranslation(
  branchId: string, keyId: string, localeId: string, value: string, status: string, userId: string
): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('translations').select('id, value, status')
    .eq('branch_id', branchId).eq('key_id', keyId).eq('locale_id', localeId).maybeSingle()

  const { data: updated, error } = await admin
    .from('translations')
    .upsert(
      { branch_id: branchId, key_id: keyId, locale_id: localeId, value, status, translated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: 'branch_id,key_id,locale_id' }
    )
    .select('id').single()

  if (error || !updated) return { error: error?.message ?? 'Failed to update translation' }

  await admin.from('translation_history').insert({
    translation_id: updated.id,
    old_value: current?.value ?? null, new_value: value,
    old_status: current?.status ?? null, new_status: status,
    changed_by: userId,
  })

  return { id: updated.id }
}

export async function createTranslationKey(data: {
  projectId: string; branchId: string; key: string; description?: string
  tags?: string[]; platforms?: string[]; charLimit?: number | null
  localeIds: string[]; userId: string
}): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient()

  // Keys are per-branch (M2): the key is created on the active branch only.
  const { data: keyRow, error } = await admin
    .from('translation_keys')
    .insert({
      project_id: data.projectId, branch_id: data.branchId, key: data.key,
      description: data.description ?? null, tags: data.tags ?? [],
      platforms: data.platforms ?? [], char_limit: data.charLimit ?? null,
      is_plural: false, created_by: data.userId,
    })
    .select('id').single()

  if (error || !keyRow) {
    const dup = error?.code === '23505'
    return { error: dup ? `Key "${data.key}" already exists on this branch` : (error?.message ?? 'Failed to create key') }
  }

  // Empty translation per locale on this branch
  if (data.localeIds.length > 0) {
    await admin.from('translations').insert(
      data.localeIds.map((localeId) => ({
        branch_id: data.branchId, key_id: keyRow.id, locale_id: localeId, value: null, status: 'empty' as const,
      }))
    )
  }

  return { id: keyRow.id }
}
