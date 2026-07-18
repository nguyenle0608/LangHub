import { createAdminClient } from '@/lib/supabase/admin'
import type { ApiTokenContext, ApiTokenScope } from './auth'

export function apiScopeAllows(actual: ApiTokenScope, required: ApiTokenScope): boolean {
  return actual === 'write' || required === 'read'
}

export interface ApiResourceStore {
  projectOrg(projectId: string): Promise<string | null>
  branchProject(branchId: string): Promise<string | null>
  localeProject(localeId: string): Promise<string | null>
}

export function createSupabaseApiResourceStore(): ApiResourceStore {
  const admin = createAdminClient()
  return {
    async projectOrg(projectId) {
      const { data, error } = await admin.from('projects').select('org_id').eq('id', projectId).maybeSingle()
      return error ? null : data?.org_id ?? null
    },
    async branchProject(branchId) {
      const { data, error } = await admin.from('branches').select('project_id').eq('id', branchId).maybeSingle()
      return error ? null : data?.project_id ?? null
    },
    async localeProject(localeId) {
      const { data, error } = await admin.from('locales').select('project_id').eq('id', localeId).maybeSingle()
      return error ? null : data?.project_id ?? null
    },
  }
}

export async function assertApiProjectAccess(
  context: ApiTokenContext,
  projectId: string,
  store: ApiResourceStore = createSupabaseApiResourceStore()
): Promise<boolean> {
  return (await store.projectOrg(projectId)) === context.orgId
}

export async function assertApiResourcesAccess(
  context: ApiTokenContext,
  projectId: string,
  resources: { branchId?: string | null; localeId?: string | null },
  store: ApiResourceStore = createSupabaseApiResourceStore()
): Promise<boolean> {
  if (!(await assertApiProjectAccess(context, projectId, store))) return false
  const [branchProject, localeProject] = await Promise.all([
    resources.branchId ? store.branchProject(resources.branchId) : Promise.resolve(projectId),
    resources.localeId ? store.localeProject(resources.localeId) : Promise.resolve(projectId),
  ])
  return branchProject === projectId && localeProject === projectId
}

