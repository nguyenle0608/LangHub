import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createSnapshot } from '@/lib/versions/snapshot'
import type { Database } from '@/types/database'

export type Branch = Database['public']['Tables']['branches']['Row']

export type BranchWithStats = Branch & {
  keyCount: number
  localeCount: number
  approvedPercent: number
}

// ── Reads: user-scoped client (RLS applies) ───────────────────────────────

export async function listBranches(projectId: string): Promise<Branch[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('branches')
    .select('*')
    .eq('project_id', projectId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
  return data ?? []
}

/** All branches of a project with per-branch key count + approval progress. */
export async function listBranchesWithStats(projectId: string): Promise<BranchWithStats[]> {
  const supabase = await createClient()
  const [branches, { data: locales }] = await Promise.all([
    listBranches(projectId),
    supabase.from('locales').select('id, is_base').eq('project_id', projectId),
  ])
  const nonBaseLocaleIds = new Set((locales ?? []).filter((l) => !l.is_base).map((l) => l.id))
  const localeCount = (locales ?? []).length

  return Promise.all(
    branches.map(async (b) => {
      const [{ count }, approvedCounts] = await Promise.all([
        supabase.from('translation_keys').select('*', { count: 'exact', head: true }).eq('branch_id', b.id),
        Promise.all(
          Array.from(nonBaseLocaleIds).map(async (localeId) => {
            const { count: approved } = await supabase
              .from('translations')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', b.id)
              .eq('locale_id', localeId)
              .eq('status', 'approved')
            return approved ?? 0
          })
        ),
      ])
      const keyCount = count ?? 0
      const approved = approvedCounts.reduce((sum, n) => sum + n, 0)
      const total = keyCount * nonBaseLocaleIds.size
      const approvedPercent = total > 0 ? Math.round((approved / total) * 100) : 0
      return { ...b, keyCount, localeCount, approvedPercent }
    })
  )
}

export async function getBranch(branchId: string): Promise<Branch | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('branches').select('*').eq('id', branchId).single()
  return data ?? null
}

export async function getDefaultBranch(projectId: string): Promise<Branch | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('branches')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_default', true)
    .maybeSingle()
  return data ?? null
}

/**
 * Resolve a (possibly undefined / cross-project) branch id to a valid branch
 * for this project, falling back to the project's default (main) branch.
 */
export async function resolveBranchId(projectId: string, branchId?: string | null): Promise<string | null> {
  if (branchId) {
    const b = await getBranch(branchId)
    if (b && b.project_id === projectId) return b.id
  }
  const def = await getDefaultBranch(projectId)
  return def?.id ?? null
}

// ── Writes: admin client (service role) ───────────────────────────────────

/**
 * Create a new branch off a source branch.
 *  1. snapshot the source branch → stored as the merge BASE (fork point)
 *  2. copy the source branch's translation rows into the new branch
 */
export async function createBranch(args: {
  projectId: string
  name: string
  sourceBranchId: string
  userId: string
}): Promise<Branch | { error: string }> {
  const admin = createAdminClient()
  const { projectId, name, sourceBranchId, userId } = args

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Branch name is required' }

  // Insert the branch row first
  const { data: branch, error: insErr } = await admin
    .from('branches')
    .insert({
      project_id: projectId,
      name: trimmed,
      parent_branch_id: sourceBranchId,
      is_default: false,
      created_by: userId,
    })
    .select('*')
    .single()

  if (insErr || !branch) {
    const dup = insErr?.code === '23505'
    return { error: dup ? `Branch "${trimmed}" already exists` : (insErr?.message ?? 'Failed to create branch') }
  }

  // Snapshot the source branch as the merge base (fork point)
  const base = await createSnapshot(projectId, userId, {
    name: `Fork base: ${trimmed}`,
    tag: 'branch_base',
    branchId: sourceBranchId,
  })
  if (!('error' in base)) {
    await admin.from('branches').update({ base_snapshot_id: base.id }).eq('id', branch.id)
    branch.base_snapshot_id = base.id
  }

  // Copy the source branch's KEYS into the new branch (M2: keys are per-branch),
  // building an old→new key id map so translations can be remapped.
  const { data: srcKeys } = await admin
    .from('translation_keys')
    .select('id, key, description, tags, platforms, char_limit, is_plural, plural_forms')
    .eq('branch_id', sourceBranchId)

  const newKeyIdByOld = new Map<string, string>()
  if (srcKeys?.length) {
    for (let i = 0; i < srcKeys.length; i += 200) {
      const chunk = srcKeys.slice(i, i + 200)
      const { data: inserted } = await admin
        .from('translation_keys')
        .insert(chunk.map((k) => ({
          project_id: projectId,
          branch_id: branch.id,
          key: k.key,
          description: k.description,
          tags: k.tags,
          platforms: k.platforms,
          char_limit: k.char_limit,
          is_plural: k.is_plural,
          plural_forms: k.plural_forms,
          created_by: userId,
        })))
        .select('id, key')
      // Map by key name (stable within a branch)
      const newIdByName = Object.fromEntries((inserted ?? []).map((r) => [r.key, r.id]))
      for (const k of chunk) {
        const newId = newIdByName[k.key]
        if (newId) newKeyIdByOld.set(k.id, newId)
      }
    }
  }

  // Copy the source branch's translation rows, remapping key_id to the new keys
  const { data: srcRows } = await admin
    .from('translations')
    .select('key_id, locale_id, value, status')
    .eq('branch_id', sourceBranchId)

  if (srcRows?.length) {
    const copies = srcRows
      .map((r) => {
        const newKeyId = r.key_id ? newKeyIdByOld.get(r.key_id) : undefined
        if (!newKeyId) return null
        return { branch_id: branch.id, key_id: newKeyId, locale_id: r.locale_id, value: r.value, status: r.status }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    for (let i = 0; i < copies.length; i += 500) {
      await admin.from('translations').insert(copies.slice(i, i + 500))
    }
  }

  return branch
}

export async function deleteBranch(branchId: string): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const { data: branch } = await admin.from('branches').select('is_default').eq('id', branchId).single()
  if (!branch) return { error: 'Branch not found' }
  if (branch.is_default) return { error: 'Cannot delete the default branch' }
  // translations cascade-delete via FK
  const { error } = await admin.from('branches').delete().eq('id', branchId)
  return error ? { error: error.message } : { success: true }
}

export async function renameBranch(branchId: string, name: string): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Branch name is required' }
  const { error } = await admin.from('branches').update({ name: trimmed }).eq('id', branchId)
  if (error) return { error: error.code === '23505' ? `Branch "${trimmed}" already exists` : error.message }
  return { success: true }
}

/** Make `branchId` the project's default (main) branch. */
export async function setDefaultBranch(projectId: string, branchId: string): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const { data: target } = await admin.from('branches').select('id, project_id').eq('id', branchId).single()
  if (!target || target.project_id !== projectId) return { error: 'Branch not found' }
  // Unset the current default first (partial unique index allows only one true)
  const { error: unsetErr } = await admin.from('branches').update({ is_default: false }).eq('project_id', projectId).eq('is_default', true)
  if (unsetErr) return { error: unsetErr.message }
  const { error } = await admin.from('branches').update({ is_default: true }).eq('id', branchId)
  return error ? { error: error.message } : { success: true }
}
