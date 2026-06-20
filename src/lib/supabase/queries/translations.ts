import { createClient } from '../server'
import { createAdminClient } from '../admin'
import type { Database } from '@/types/database'

type TranslationRow = Database['public']['Tables']['translations']['Row']
type KeyRow = Database['public']['Tables']['translation_keys']['Row']

export type KeyWithTranslations = KeyRow & { translations: TranslationRow[] }

// ── Reads: user-scoped client (RLS applies) ───────────────────────────────

const PAGE_SIZE = 1000

export async function getTranslationKeys(
  projectId: string,
  opts?: { search?: string; status?: string; tags?: string[] }
): Promise<KeyWithTranslations[]> {
  const supabase = await createClient()

  // Paginate to bypass PostgREST's 1000-row default limit
  const all: KeyWithTranslations[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('translation_keys')
      .select('*, translations(*)')
      .eq('project_id', projectId)
      .order('key', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

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
  keyId: string, localeId: string, value: string, status: string, userId: string
): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('translations').select('id, value, status')
    .eq('key_id', keyId).eq('locale_id', localeId).maybeSingle()

  const { data: updated, error } = await admin
    .from('translations')
    .upsert(
      { key_id: keyId, locale_id: localeId, value, status, translated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: 'key_id,locale_id' }
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
  projectId: string; key: string; description?: string
  tags?: string[]; platforms?: string[]; charLimit?: number | null
  localeIds: string[]; userId: string
}): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient()

  const { data: keyRow, error } = await admin
    .from('translation_keys')
    .insert({
      project_id: data.projectId, key: data.key,
      description: data.description ?? null, tags: data.tags ?? [],
      platforms: data.platforms ?? [], char_limit: data.charLimit ?? null,
      is_plural: false, created_by: data.userId,
    })
    .select('id').single()

  if (error || !keyRow) return { error: error?.message ?? 'Failed to create key' }

  if (data.localeIds.length > 0) {
    await admin.from('translations').insert(
      data.localeIds.map((localeId) => ({
        key_id: keyRow.id, locale_id: localeId, value: null, status: 'empty' as const,
      }))
    )
  }

  return { id: keyRow.id }
}
