import { createAdminClient } from '@/lib/supabase/admin'
import type { MemberRole } from '@/types'

// Higher number = more privilege. Translation writes require 'translator'+;
// workspace/project administration requires 'admin' or 'owner'.
const RANK: Record<MemberRole, number> = { viewer: 0, translator: 1, admin: 2, owner: 3 }

export function roleAtLeast(role: MemberRole | null, minRole: MemberRole): boolean {
  return role != null && RANK[role] >= RANK[minRole]
}

export type AccessResult<T extends object = object> =
  | ({ ok: true; role: MemberRole } & T)
  | { ok: false }

/** Server-side authorization gate for service-role operations. */
export async function assertOrgAccess(
  userId: string,
  orgId: string | null | undefined,
  minRole: MemberRole = 'viewer'
): Promise<AccessResult<{ orgId: string }>> {
  if (!orgId) return { ok: false }
  const admin = createAdminClient()
  const { data } = await admin
    .from('members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  const role = data?.role as MemberRole | null
  return roleAtLeast(role, minRole) ? { ok: true, role: role!, orgId } : { ok: false }
}

export async function assertProjectAccess(
  userId: string,
  projectId: string,
  minRole: MemberRole = 'viewer'
): Promise<AccessResult<{ projectId: string; orgId: string }>> {
  const admin = createAdminClient()
  const { data } = await admin.from('projects').select('org_id').eq('id', projectId).maybeSingle()
  const access = await assertOrgAccess(userId, data?.org_id, minRole)
  return access.ok ? { ...access, projectId } : { ok: false }
}

export async function assertBranchAccess(
  userId: string,
  branchId: string,
  minRole: MemberRole = 'viewer',
  expectedProjectId?: string
): Promise<AccessResult<{ branchId: string; projectId: string; orgId: string }>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('branches')
    .select('project_id, projects(org_id)')
    .eq('id', branchId)
    .maybeSingle()
  if (!data?.project_id || (expectedProjectId && data.project_id !== expectedProjectId)) return { ok: false }
  const project = Array.isArray(data.projects) ? data.projects[0] : data.projects
  const access = await assertOrgAccess(userId, project?.org_id, minRole)
  return access.ok ? { ...access, branchId, projectId: data.project_id } : { ok: false }
}

export async function assertKeysAccess(
  userId: string,
  keyIds: string[],
  minRole: MemberRole = 'viewer',
  options?: { projectId?: string; branchId?: string; requireSameBranch?: boolean }
): Promise<AccessResult<{ projectIds: string[]; branchIds: string[] }>> {
  const ids = Array.from(new Set(keyIds))
  if (ids.length === 0) return { ok: false }
  const admin = createAdminClient()
  const data: Array<{ id: string; project_id: string | null; branch_id: string | null }> = []
  for (let index = 0; index < ids.length; index += 100) {
    const { data: rows, error } = await admin
      .from('translation_keys')
      .select('id, project_id, branch_id')
      .in('id', ids.slice(index, index + 100))
    if (error || !rows) return { ok: false }
    data.push(...rows)
  }
  if (data.length !== ids.length) return { ok: false }

  const projectIds = Array.from(new Set(data.map((row) => row.project_id).filter(Boolean) as string[]))
  const branchIds = Array.from(new Set(data.map((row) => row.branch_id).filter(Boolean) as string[]))
  if (
    projectIds.length === 0 ||
    (options?.projectId && (projectIds.length !== 1 || projectIds[0] !== options.projectId)) ||
    (options?.branchId && (branchIds.length !== 1 || branchIds[0] !== options.branchId)) ||
    (options?.requireSameBranch && branchIds.length !== 1)
  ) return { ok: false }

  let lowestRole: MemberRole | null = null
  for (const projectId of projectIds) {
    const access = await assertProjectAccess(userId, projectId, minRole)
    if (!access.ok) return { ok: false }
    if (lowestRole == null || RANK[access.role] < RANK[lowestRole]) lowestRole = access.role
  }
  return lowestRole ? { ok: true, role: lowestRole, projectIds, branchIds } : { ok: false }
}

export async function assertLocalesAccess(
  userId: string,
  localeIds: string[],
  minRole: MemberRole = 'viewer',
  expectedProjectId?: string
): Promise<AccessResult<{ projectId: string }>> {
  const ids = Array.from(new Set(localeIds))
  if (ids.length === 0) return { ok: false }
  const admin = createAdminClient()
  const data: Array<{ id: string; project_id: string | null }> = []
  for (let index = 0; index < ids.length; index += 100) {
    const { data: rows, error } = await admin
      .from('locales')
      .select('id, project_id')
      .in('id', ids.slice(index, index + 100))
    if (error || !rows) return { ok: false }
    data.push(...rows)
  }
  if (data.length !== ids.length) return { ok: false }
  const projectIds = Array.from(new Set(data.map((row) => row.project_id).filter(Boolean) as string[]))
  if (projectIds.length !== 1 || (expectedProjectId && projectIds[0] !== expectedProjectId)) return { ok: false }
  const projectId = projectIds[0]!
  const access = await assertProjectAccess(userId, projectId, minRole)
  return access.ok ? { ok: true, role: access.role, projectId } : { ok: false }
}

export async function assertVersionAccess(
  userId: string,
  versionId: string,
  minRole: MemberRole = 'viewer',
  expectedProjectId?: string
): Promise<AccessResult<{ versionId: string; projectId: string }>> {
  const admin = createAdminClient()
  const { data } = await admin.from('versions').select('project_id').eq('id', versionId).maybeSingle()
  if (!data?.project_id || (expectedProjectId && data.project_id !== expectedProjectId)) return { ok: false }
  const access = await assertProjectAccess(userId, data.project_id, minRole)
  return access.ok ? { ok: true, role: access.role, versionId, projectId: data.project_id } : { ok: false }
}

export async function assertTranslationItemsAccess(
  userId: string,
  branchId: string,
  keyIds: string[],
  localeIds: string[],
  minRole: MemberRole = 'translator'
): Promise<AccessResult<{ projectId: string }>> {
  const branch = await assertBranchAccess(userId, branchId, minRole)
  if (!branch.ok) return { ok: false }
  const [keys, locales] = await Promise.all([
    assertKeysAccess(userId, keyIds, minRole, { projectId: branch.projectId, branchId }),
    assertLocalesAccess(userId, localeIds, minRole, branch.projectId),
  ])
  return keys.ok && locales.ok
    ? { ok: true, role: branch.role, projectId: branch.projectId }
    : { ok: false }
}
