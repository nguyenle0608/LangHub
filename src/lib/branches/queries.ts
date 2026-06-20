import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createSnapshot } from '@/lib/versions/snapshot'
import type { Database } from '@/types/database'

export type Branch = Database['public']['Tables']['branches']['Row']

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

  // Copy the source branch's translation rows into the new branch
  const { data: srcRows } = await admin
    .from('translations')
    .select('key_id, locale_id, value, status')
    .eq('branch_id', sourceBranchId)

  if (srcRows?.length) {
    const copies = srcRows.map((r) => ({
      branch_id: branch.id,
      key_id: r.key_id,
      locale_id: r.locale_id,
      value: r.value,
      status: r.status,
    }))
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
