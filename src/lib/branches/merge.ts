import { createAdminClient } from '@/lib/supabase/admin'
import { createSnapshot } from '@/lib/versions/snapshot'
import { fetchBranchTranslations } from '@/lib/branches/fetch'

// A cell identity that survives rename/delete: "key_name::locale_code"
type CellKey = string
function cellKey(keyName: string, localeCode: string): CellKey {
  return `${keyName}::${localeCode}`
}

type Cell = { value: string | null; status: string | null }

export type MergeConflict = {
  keyName: string
  localeCode: string
  base: Cell | null
  ours: Cell | null   // target branch (e.g. main)
  theirs: Cell | null // source branch (e.g. feature)
}

export type AutoMerge = {
  keyName: string
  localeCode: string
  value: string | null   // incoming (source) value to apply
  status: string | null
  ours: Cell | null      // current target value (for before→after preview)
}

export type MergePlan = {
  auto: AutoMerge[]
  conflicts: MergeConflict[]
}

export type Resolution = {
  keyName: string
  localeCode: string
  value: string | null
  status: string | null
}

function sameCell(a: Cell | null, b: Cell | null): boolean {
  return (a?.value ?? null) === (b?.value ?? null) && (a?.status ?? null) === (b?.status ?? null)
}

/** Fetch a branch's current translations as a map keyed by key_name::locale_code. */
async function fetchBranchCells(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  branchId: string
): Promise<Map<CellKey, Cell>> {
  const [{ data: keys }, { data: locales }] = await Promise.all([
    admin.from('translation_keys').select('id, key').eq('project_id', projectId),
    admin.from('locales').select('id, code').eq('project_id', projectId),
  ])
  const keyName = Object.fromEntries((keys ?? []).map((k) => [k.id, k.key]))
  const localeCode = Object.fromEntries((locales ?? []).map((l) => [l.id, l.code]))

  const map = new Map<CellKey, Cell>()
  const trans = await fetchBranchTranslations(admin, branchId)

  for (const t of trans) {
    const kn = keyName[t.key_id ?? '']
    const lc = localeCode[t.locale_id ?? '']
    if (kn && lc) map.set(cellKey(kn, lc), { value: t.value, status: t.status })
  }
  return map
}

/** Fetch the base (fork-point) snapshot as a map keyed by key_name::locale_code. */
async function fetchBaseCells(
  admin: ReturnType<typeof createAdminClient>,
  baseSnapshotId: string | null
): Promise<Map<CellKey, Cell>> {
  const map = new Map<CellKey, Cell>()
  if (!baseSnapshotId) return map
  const { data: snaps } = await admin
    .from('version_snapshots')
    .select('key_name, locale_code, value, status')
    .eq('version_id', baseSnapshotId)
  for (const s of snaps ?? []) {
    map.set(cellKey(s.key_name, s.locale_code), { value: s.value, status: s.status })
  }
  return map
}

/**
 * Compute a 3-way merge plan for merging `sourceBranchId` INTO `targetBranchId`.
 *  base   = source branch's fork-point snapshot (state of target at fork time)
 *  ours   = target branch current
 *  theirs = source branch current
 */
export async function computeMerge(
  projectId: string,
  sourceBranchId: string,
  targetBranchId: string
): Promise<MergePlan | { error: string }> {
  const admin = createAdminClient()

  const { data: source } = await admin
    .from('branches').select('base_snapshot_id').eq('id', sourceBranchId).single()
  if (!source) return { error: 'Source branch not found' }

  const [base, ours, theirs] = await Promise.all([
    fetchBaseCells(admin, source.base_snapshot_id),
    fetchBranchCells(admin, projectId, targetBranchId),
    fetchBranchCells(admin, projectId, sourceBranchId),
  ])

  const auto: AutoMerge[] = []
  const conflicts: MergeConflict[] = []

  // Only cells that changed on the source side relative to base are candidates.
  for (const [ck, theirCell] of Array.from(theirs.entries())) {
    const baseCell = base.get(ck) ?? null
    if (sameCell(theirCell, baseCell)) continue // source didn't change this cell

    const ourCell = ours.get(ck) ?? null
    const [keyName, localeCode] = ck.split('::') as [string, string]

    if (sameCell(ourCell, baseCell)) {
      // target untouched since fork → take source's change
      auto.push({ keyName, localeCode, value: theirCell.value, status: theirCell.status, ours: ourCell })
    } else if (sameCell(ourCell, theirCell)) {
      // both sides made the same change → nothing to do
      continue
    } else {
      // both changed differently → conflict
      conflicts.push({ keyName, localeCode, base: baseCell, ours: ourCell, theirs: theirCell })
    }
  }

  return { auto, conflicts }
}

/**
 * Apply a merge into the target branch: auto-merges + provided conflict resolutions.
 * Snapshots the target branch first (destructive-op rule). Re-bases the source
 * branch onto the post-merge target so subsequent merges stay clean.
 */
export async function applyMerge(args: {
  projectId: string
  sourceBranchId: string
  targetBranchId: string
  userId: string
  auto: AutoMerge[]
  resolutions: Resolution[]
}): Promise<{ merged: number; skipped: number; backupVersionId?: string } | { error: string }> {
  const { projectId, sourceBranchId, targetBranchId, userId, auto, resolutions } = args
  const admin = createAdminClient()

  // 1. Backup target branch before applying
  const backup = await createSnapshot(projectId, userId, {
    name: `Auto: Before merge into target`,
    tag: 'auto_before_merge',
    branchId: targetBranchId,
  })
  const backupVersionId = 'error' in backup ? undefined : backup.id

  // 2. Resolve key/locale names → ids in the project
  const [{ data: keys }, { data: locales }] = await Promise.all([
    admin.from('translation_keys').select('id, key').eq('project_id', projectId),
    admin.from('locales').select('id, code').eq('project_id', projectId),
  ])
  const keyIdByName = Object.fromEntries((keys ?? []).map((k) => [k.key, k.id]))
  const localeIdByCode = Object.fromEntries((locales ?? []).map((l) => [l.code, l.id]))

  const all = [...auto, ...resolutions]
  let merged = 0
  let skipped = 0

  const rows = all.map((c) => {
    const keyId = keyIdByName[c.keyName]
    const localeId = localeIdByCode[c.localeCode]
    if (!keyId || !localeId) { skipped++; return null }
    merged++
    return {
      branch_id: targetBranchId,
      key_id: keyId,
      locale_id: localeId,
      value: c.value,
      status: c.status ?? 'empty',
      updated_at: new Date().toISOString(),
    }
  }).filter((r): r is NonNullable<typeof r> => r !== null)

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin
      .from('translations')
      .upsert(rows.slice(i, i + 500), { onConflict: 'branch_id,key_id,locale_id' })
    if (error) return { error: error.message }
  }

  // 3. Re-base the source branch onto the new target state
  const rebase = await createSnapshot(projectId, userId, {
    name: `Re-base after merge`,
    tag: 'branch_base',
    branchId: targetBranchId,
  })
  if (!('error' in rebase)) {
    await admin.from('branches').update({ base_snapshot_id: rebase.id }).eq('id', sourceBranchId)
  }

  return { merged, skipped, backupVersionId }
}
