import { createAdminClient } from '@/lib/supabase/admin'
import { fetchBranchTranslations } from '@/lib/branches/fetch'
import type { Database } from '@/types/database'

type VersionRow = Database['public']['Tables']['versions']['Row']
type VersionStatsRow = Database['public']['Tables']['version_stats']['Row']

export type VersionWithStats = VersionRow & { stats: VersionStatsRow | null }

export type RestoreOptions = {
  scope: 'all' | 'locale' | 'keys'
  localeCode?: string
  keyNames?: string[]
  createBackupFirst: boolean
}

export async function createSnapshot(
  projectId: string,
  userId: string,
  meta: { name: string; description?: string; tag?: string; branchId?: string }
): Promise<VersionWithStats | { error: string }> {
  const admin = createAdminClient()

  // 1. Insert version row
  const { data: version, error: verErr } = await admin
    .from('versions')
    .insert({
      project_id: projectId,
      created_by: userId,
      name: meta.name,
      description: meta.description ?? null,
      tag: meta.tag ?? 'manual',
      branch_id: meta.branchId ?? null,
    })
    .select('*')
    .single()

  if (verErr || !version) return { error: verErr?.message ?? 'Failed to create version' }

  // 2. Fetch all keys for this project
  const { data: keys } = await admin
    .from('translation_keys')
    .select('id, key')
    .eq('project_id', projectId)

  if (!keys?.length) {
    // No keys — still create empty version with zero stats
    await admin.from('version_stats').insert({
      version_id: version.id,
      total_keys: 0,
      total_locales: 0,
      approved_count: 0,
      pending_count: 0,
      empty_count: 0,
    })
    return { ...version, stats: { version_id: version.id, total_keys: 0, total_locales: 0, approved_count: 0, pending_count: 0, empty_count: 0 } }
  }

  const keyNameById = Object.fromEntries(keys.map((k) => [k.id, k.key]))

  // 3. Fetch all locales
  const { data: locales } = await admin
    .from('locales')
    .select('id, code')
    .eq('project_id', projectId)

  const localeCodeById = Object.fromEntries((locales ?? []).map((l) => [l.id, l.code]))

  // 4. Fetch all translations for the branch (paginated; scoped by branch_id
  //    to avoid over-long .in(keyIds) URLs and the 1000-row cap)
  const translations = meta.branchId
    ? await fetchBranchTranslations(admin, meta.branchId)
    : []

  if (!translations?.length) {
    await admin.from('version_stats').insert({
      version_id: version.id,
      total_keys: keys.length,
      total_locales: locales?.length ?? 0,
      approved_count: 0,
      pending_count: 0,
      empty_count: 0,
    })
    return { ...version, stats: { version_id: version.id, total_keys: keys.length, total_locales: locales?.length ?? 0, approved_count: 0, pending_count: 0, empty_count: 0 } }
  }

  // 5. Bulk insert snapshots
  const snapshots = translations.map((t) => ({
    version_id: version.id,
    key_id: t.key_id,
    key_name: keyNameById[t.key_id ?? ''] ?? '',
    locale_id: t.locale_id,
    locale_code: localeCodeById[t.locale_id ?? ''] ?? '',
    value: t.value,
    status: t.status,
  }))

  // Insert in chunks of 500 to avoid limits
  for (let i = 0; i < snapshots.length; i += 500) {
    const chunk = snapshots.slice(i, i + 500)
    await admin.from('version_snapshots').insert(chunk)
  }

  // 6. Compute stats
  const approved = translations.filter((t) => t.status === 'approved').length
  const pending = translations.filter((t) => t.status === 'pending' || t.status === 'reviewed').length
  const empty = translations.filter((t) => !t.value || t.status === 'empty').length

  const stats = {
    version_id: version.id,
    total_keys: keys.length,
    total_locales: locales?.length ?? 0,
    approved_count: approved,
    pending_count: pending,
    empty_count: empty,
  }

  await admin.from('version_stats').insert(stats)

  return { ...version, stats }
}

export async function getVersions(projectId: string): Promise<VersionWithStats[]> {
  const admin = createAdminClient()

  const { data: versions } = await admin
    .from('versions')
    .select('*, version_stats(*)')
    .eq('project_id', projectId)
    .neq('tag', 'branch_base') // hide internal fork-base snapshots
    .order('created_at', { ascending: false })

  if (!versions) return []

  return versions.map((v) => {
    const statsArr = v.version_stats
    const stats = Array.isArray(statsArr) ? statsArr[0] ?? null : statsArr
    return { ...v, version_stats: undefined, stats } as unknown as VersionWithStats
  })
}

export async function getVersion(versionId: string): Promise<VersionWithStats | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('versions')
    .select('*, version_stats(*)')
    .eq('id', versionId)
    .single()
  if (!data) return null
  const statsArr = data.version_stats
  const stats = Array.isArray(statsArr) ? statsArr[0] ?? null : statsArr
  return { ...data, version_stats: undefined, stats } as unknown as VersionWithStats
}

export async function deleteVersion(versionId: string): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  // Only allow deleting manual versions
  const { data: v } = await admin.from('versions').select('tag').eq('id', versionId).single()
  if (v?.tag !== 'manual') return { error: 'Only manual versions can be deleted' }
  const { error } = await admin.from('versions').delete().eq('id', versionId)
  return error ? { error: error.message } : { success: true }
}

export async function restoreSnapshot(
  versionId: string,
  projectId: string,
  userId: string,
  branchId: string,
  options: RestoreOptions
): Promise<{ restored: number; skipped: number; backupVersionId?: string } | { error: string }> {
  const admin = createAdminClient()

  // 1. Auto-backup if requested (backs up the target branch)
  let backupVersionId: string | undefined
  if (options.createBackupFirst) {
    const backup = await createSnapshot(projectId, userId, {
      name: `Auto: Before restoring snapshot`,
      tag: 'auto_before_restore',
      branchId,
    })
    if ('error' in backup) return { error: `Backup failed: ${backup.error}` }
    backupVersionId = backup.id
  }

  // 2. Fetch snapshot rows, filtered by scope
  let query = admin
    .from('version_snapshots')
    .select('*')
    .eq('version_id', versionId)

  if (options.scope === 'locale' && options.localeCode) {
    query = query.eq('locale_code', options.localeCode)
  } else if (options.scope === 'keys' && options.keyNames?.length) {
    query = query.in('key_name', options.keyNames)
  }

  const { data: snapshots } = await query
  if (!snapshots?.length) return { restored: 0, skipped: 0, backupVersionId }

  // 3. Fetch current keys and locales (need IDs)
  const { data: keys } = await admin
    .from('translation_keys')
    .select('id, key')
    .eq('project_id', projectId)

  const { data: locales } = await admin
    .from('locales')
    .select('id, code')
    .eq('project_id', projectId)

  const keyIdByName = Object.fromEntries((keys ?? []).map((k) => [k.key, k.id]))
  const localeIdByCode = Object.fromEntries((locales ?? []).map((l) => [l.code, l.id]))

  let restored = 0
  let skipped = 0

  // 4. Upsert translations + history
  for (const snap of snapshots) {
    const keyId = keyIdByName[snap.key_name]
    const localeId = localeIdByCode[snap.locale_code]
    if (!keyId || !localeId) { skipped++; continue }

    // Get current value for history
    const { data: current } = await admin
      .from('translations')
      .select('id, value, status')
      .eq('branch_id', branchId)
      .eq('key_id', keyId)
      .eq('locale_id', localeId)
      .maybeSingle()

    const { data: upserted, error } = await admin
      .from('translations')
      .upsert(
        { branch_id: branchId, key_id: keyId, locale_id: localeId, value: snap.value, status: snap.status ?? 'empty', updated_at: new Date().toISOString() },
        { onConflict: 'branch_id,key_id,locale_id' }
      )
      .select('id')
      .single()

    if (error || !upserted) { skipped++; continue }

    await admin.from('translation_history').insert({
      translation_id: upserted.id,
      old_value: current?.value ?? null,
      new_value: snap.value,
      old_status: current?.status ?? null,
      new_status: snap.status,
      changed_by: userId,
    })

    restored++
  }

  return { restored, skipped, backupVersionId }
}
