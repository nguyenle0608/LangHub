import { createClient } from '../server'
import { createAdminClient } from '../admin'
import type { Database } from '@/types/database'

type KeyRow = Database['public']['Tables']['translation_keys']['Row']
type CommentRow = Database['public']['Tables']['comments']['Row']

export type DuplicateGroup = {
  baseValue: string
  localeCode: string
  keys: Pick<KeyRow, 'id' | 'key' | 'description' | 'tags'>[]
}

export type Comment = CommentRow & { user_email?: string }

// ── Reads ────────────────────────────────────────────────────────────────────

export async function findDuplicateGroups(projectId: string, branchId: string): Promise<DuplicateGroup[]> {
  const supabase = await createClient()

  // Keys are per-branch (M2) — scope to the given branch
  const { data: keys } = await supabase
    .from('translation_keys')
    .select('id, key, description, tags, project_id')
    .eq('project_id', projectId)
    .eq('branch_id', branchId)

  if (!keys?.length) return []

  // Get base locale for the project
  const { data: baseLocale } = await supabase
    .from('locales')
    .select('id, code')
    .eq('project_id', projectId)
    .eq('is_base', true)
    .single()

  if (!baseLocale) return []

  // Base-locale translations on this branch (scope by branch_id, not a huge .in())
  const { data: translations } = await supabase
    .from('translations')
    .select('key_id, value')
    .eq('branch_id', branchId)
    .eq('locale_id', baseLocale.id)
    .not('value', 'is', null)
    .neq('value', '')

  if (!translations?.length) return []

  // Group by value
  const valueMap = new Map<string, string[]>()
  for (const t of translations) {
    if (!t.value || !t.key_id) continue
    const existing = valueMap.get(t.value) ?? []
    existing.push(t.key_id)
    valueMap.set(t.value, existing)
  }

  // Only groups with more than 1 key
  const groups: DuplicateGroup[] = []
  for (const entry of Array.from(valueMap.entries())) {
    const [value, dupKeyIds] = entry
    if (dupKeyIds.length < 2) continue
    const groupKeys = dupKeyIds
      .map((id) => keys.find((k: typeof keys[0]) => k.id === id))
      .filter((k): k is NonNullable<typeof k> => k !== undefined)
      .map((k) => ({ id: k.id, key: k.key, description: k.description, tags: k.tags }))
    groups.push({ baseValue: value, localeCode: baseLocale.code, keys: groupKeys })
  }

  return groups.sort((a, b) => b.keys.length - a.keys.length)
}

export async function getComments(keyId: string): Promise<Comment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('comments')
    .select('*')
    .eq('key_id', keyId)
    .order('created_at', { ascending: true })
  return data ?? []
}

// ── Writes ───────────────────────────────────────────────────────────────────

export async function mergeKeys(
  parentKeyId: string,
  childKeyIds: string[],
  projectId: string,
  userId: string
): Promise<{ success: true; snapshotId: string } | { error: string }> {
  const admin = createAdminClient()

  // Auto-snapshot before merge
  const { data: versionRow, error: versionError } = await admin
    .from('versions')
    .insert({
      project_id: projectId,
      created_by: userId,
      name: `Auto: Before merging ${childKeyIds.length + 1} duplicate keys`,
      description: `Merged keys: ${childKeyIds.join(', ')} into ${parentKeyId}`,
      tag: 'auto_bulk_delete',
    })
    .select('id')
    .single()

  if (versionError || !versionRow) {
    return { error: versionError?.message ?? 'Failed to create snapshot' }
  }

  // Snapshot all translations before deletion
  const { data: keys } = await admin
    .from('translation_keys')
    .select('id, key')
    .in('id', [parentKeyId, ...childKeyIds])

  if (keys?.length) {
    const keyIds = keys.map((k) => k.id)
    const { data: translations } = await admin
      .from('translations')
      .select('*, translation_keys(key), locales(code)')
      .in('key_id', keyIds)

    if (translations?.length) {
      await admin.from('version_snapshots').insert(
        translations.map((t) => {
          const keyName = Array.isArray(t.translation_keys)
            ? (t.translation_keys[0] as { key: string } | undefined)?.key ?? ''
            : (t.translation_keys as { key: string } | null)?.key ?? ''
          const localeCode = Array.isArray(t.locales)
            ? (t.locales[0] as { code: string } | undefined)?.code ?? ''
            : (t.locales as { code: string } | null)?.code ?? ''
          return {
            version_id: versionRow.id,
            key_name: keyName,
            locale_code: localeCode,
            value: t.value,
            status: t.status,
          }
        })
      )
    }
  }

  // Delete child keys (cascade deletes their translations)
  const { error: deleteError } = await admin
    .from('translation_keys')
    .delete()
    .in('id', childKeyIds)

  if (deleteError) return { error: deleteError.message }

  return { success: true, snapshotId: versionRow.id }
}

export async function linkKeys(
  parentKeyId: string,
  childKeyId: string
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('translation_keys')
    .update({ reference_key_id: parentKeyId })
    .eq('id', childKeyId)
  return error ? { error: error.message } : { success: true }
}

export async function renameKey(
  keyId: string,
  newKey: string
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('translation_keys')
    .update({ key: newKey })
    .eq('id', keyId)
  return error ? { error: error.message } : { success: true }
}

export async function updateKeyMeta(
  keyId: string,
  data: { description?: string; tags?: string[]; platforms?: string[]; charLimit?: number | null }
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const patch: Database['public']['Tables']['translation_keys']['Update'] = {}
  if (data.description !== undefined) patch.description = data.description
  if (data.tags !== undefined) patch.tags = data.tags
  if (data.platforms !== undefined) patch.platforms = data.platforms
  if (data.charLimit !== undefined) patch.char_limit = data.charLimit
  const { error } = await admin.from('translation_keys').update(patch).eq('id', keyId)
  return error ? { error: error.message } : { success: true }
}

export async function addComment(
  keyId: string,
  userId: string,
  message: string
): Promise<Comment | { error: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('comments')
    .insert({ key_id: keyId, user_id: userId, message })
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'Failed to add comment' }
  return data
}

export async function deleteComment(
  commentId: string
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('comments').delete().eq('id', commentId)
  return error ? { error: error.message } : { success: true }
}
