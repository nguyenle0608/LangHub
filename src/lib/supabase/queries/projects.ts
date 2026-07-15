import { cache } from 'react'
import { createClient } from '../server'
import { createAdminClient } from '../admin'
import type { Database } from '@/types/database'
import type { LocaleWithStats, ProjectWithStats } from '@/types'

type LocaleRow = Database['public']['Tables']['locales']['Row']
type ProjectsDashboardRow = Database['public']['Functions']['get_projects_dashboard']['Returns'][number]

const LOCALE_NAMES: Record<string, string> = {
  en: 'English', vi: 'Tiếng Việt', ja: '日本語', ko: '한국어',
  zh: '中文', fr: 'Français', de: 'Deutsch', es: 'Español',
  pt: 'Português', th: 'ภาษาไทย', id: 'Bahasa Indonesia',
}

function isLocaleWithStats(value: unknown): value is LocaleWithStats {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<LocaleWithStats>
  return (
    typeof item.id === 'string' &&
    typeof item.code === 'string' &&
    typeof item.name === 'string' &&
    typeof item.is_base === 'boolean' &&
    typeof item.total === 'number' &&
    typeof item.approved === 'number' &&
    typeof item.percent === 'number'
  )
}

function mapProjectsDashboardRow(row: ProjectsDashboardRow): ProjectWithStats {
  const rawLocales = Array.isArray(row.locales) ? row.locales : []
  const locales = rawLocales.filter(isLocaleWithStats)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    base_locale: row.base_locale,
    created_at: row.created_at,
    org_id: row.org_id,
    key_count: Number(row.key_count ?? 0),
    locale_count: Number(row.locale_count ?? locales.length),
    overall_percent: Number(row.overall_percent ?? 0),
    locales,
  }
}

function computeLocaleStatsFromApproved(
  locales: LocaleRow[],
  approvedByLocale: Map<string, number>,
  totalKeys: number
): LocaleWithStats[] {
  return locales.map((locale) => {
    const approved = approvedByLocale.get(locale.id) ?? 0
    const percent = totalKeys > 0 ? Math.round((approved / totalKeys) * 100) : 0
    return { id: locale.id, code: locale.code, name: locale.name, is_base: locale.is_base ?? false, total: totalKeys, approved, percent }
  })
}

function computeEmptyLocaleStats(locales: LocaleRow[]): LocaleWithStats[] {
  return locales.map((locale) => ({
    id: locale.id,
    code: locale.code,
    name: locale.name,
    is_base: locale.is_base ?? false,
    total: 0,
    approved: 0,
    percent: 0,
  }))
}

function computeOverallPercent(localesWithStats: LocaleWithStats[], totalKeys: number): number {
  const nonBase = localesWithStats.filter((l) => !l.is_base)
  const overallApproved = nonBase.reduce((sum, l) => sum + l.approved, 0)
  const overallTotal = totalKeys * nonBase.length
  return overallTotal > 0 ? Math.round((overallApproved / overallTotal) * 100) : 0
}

async function getBranchStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string,
  locales: LocaleRow[]
): Promise<{ totalKeys: number; approvedByLocale: Map<string, number> }> {
  const { count } = await supabase
    .from('translation_keys')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', branchId)

  const totalKeys = count ?? 0
  if (totalKeys === 0 || locales.length === 0) {
    return { totalKeys, approvedByLocale: new Map() }
  }

  // Count approved cells in Postgres instead of transferring every translation
  // row to the server just to compute progress percentages.
  const approvedCounts = await Promise.all(
    locales.map(async (locale) => {
      const { count: approved } = await supabase
        .from('translations')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .eq('locale_id', locale.id)
        .eq('status', 'approved')
      return [locale.id, approved ?? 0] as const
    })
  )

  return { totalKeys, approvedByLocale: new Map(approvedCounts) }
}

async function getDefaultBranchStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  locales: LocaleRow[]
): Promise<{ totalKeys: number; approvedByLocale: Map<string, number> }> {
  // Project-level stats reflect the default (main) branch only. Keys are
  // per-branch (M2), so both the key count and translations are scoped to main.
  const { data: mainBranch } = await supabase
    .from('branches')
    .select('id')
    .eq('project_id', projectId)
    .eq('is_default', true)
    .maybeSingle()
  if (!mainBranch) return { totalKeys: 0, approvedByLocale: new Map() }

  return getBranchStats(supabase, mainBranch.id, locales)
}

type ProjectStats = { totalKeys: number; approvedByLocale: Map<string, number> }

// Stats for a list of projects. Resolves default branches in one query, then
// uses HEAD count queries so large translation tables are counted in Postgres
// instead of streamed into the Next.js server.
async function getProjectsTranslationStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectIds: string[],
  localesByProject: Record<string, LocaleRow[]>
): Promise<Map<string, ProjectStats>> {
  const result = new Map<string, ProjectStats>()
  if (!projectIds.length) return result

  // 1. Default (main) branch per project.
  const { data: branches } = await supabase
    .from('branches')
    .select('id, project_id')
    .in('project_id', projectIds)
    .eq('is_default', true)

  const branchToProject = new Map<string, string>()
  for (const b of branches ?? []) {
    if (b.project_id) branchToProject.set(b.id, b.project_id)
  }
  const branchIds = Array.from(branchToProject.keys())
  for (const pid of projectIds) result.set(pid, { totalKeys: 0, approvedByLocale: new Map() })
  if (!branchIds.length) return result

  await Promise.all(
    Array.from(branchToProject).map(async ([branchId, projectId]) => {
      const locales = localesByProject[projectId] ?? []
      result.set(projectId, await getBranchStats(supabase, branchId, locales))
    })
  )
  return result
}

// ── Reads: user-scoped client (RLS applies) ───────────────────────────────

export async function getProjects(userId: string): Promise<ProjectWithStats[]> {
  const supabase = await createClient()

  const { data: memberships } = await supabase.from('members').select('org_id').eq('user_id', userId)
  if (!memberships?.length) return []

  const orgIds = memberships.map((m) => m.org_id).filter((id): id is string => id !== null)
  if (!orgIds.length) return []

  const { data: projectRows } = await supabase
    .from('projects').select('*').in('org_id', orgIds).order('created_at', { ascending: false })

  if (!projectRows?.length) return []

  const { data: localeRows } = await supabase
    .from('locales').select('*').in('project_id', projectRows.map((p) => p.id))

  const localesByProject = (localeRows ?? []).reduce<Record<string, LocaleRow[]>>((acc, l) => {
    const pid = l.project_id ?? ''
    if (pid) acc[pid] = [...(acc[pid] ?? []), l]
    return acc
  }, {})

  const statsByProject = await getProjectsTranslationStats(
    supabase,
    projectRows.map((p) => p.id),
    localesByProject
  )

  return projectRows.map((project) => {
    const locales = localesByProject[project.id] ?? []
    const { totalKeys, approvedByLocale } = statsByProject.get(project.id) ?? { totalKeys: 0, approvedByLocale: new Map() }
    const localesWithStats = computeLocaleStatsFromApproved(locales, approvedByLocale, totalKeys)
    const overallPercent = computeOverallPercent(localesWithStats, totalKeys)
    return { ...project, key_count: totalKeys, locale_count: locales.length, overall_percent: overallPercent, locales: localesWithStats } satisfies ProjectWithStats
  })
}

export async function getProjectsByOrg(orgId: string): Promise<ProjectWithStats[]> {
  const supabase = await createClient()

  const { data: dashboardRows, error: dashboardError } = await supabase.rpc('get_projects_dashboard', {
    p_org_id: orgId,
  })

  if (!dashboardError && dashboardRows) {
    return dashboardRows.map(mapProjectsDashboardRow)
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[perf] get_projects_dashboard RPC failed; falling back to client queries: ${dashboardError?.message ?? 'unknown error'}`
    )
  }

  const { data: projectRows } = await supabase
    .from('projects')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (!projectRows?.length) return []

  const { data: localeRows } = await supabase
    .from('locales')
    .select('*')
    .in('project_id', projectRows.map((p) => p.id))

  const localesByProject = (localeRows ?? []).reduce<Record<string, LocaleRow[]>>((acc, l) => {
    const pid = l.project_id ?? ''
    if (pid) acc[pid] = [...(acc[pid] ?? []), l]
    return acc
  }, {})

  const statsByProject = await getProjectsTranslationStats(
    supabase,
    projectRows.map((p) => p.id),
    localesByProject
  )

  return projectRows.map((project) => {
    const locales = localesByProject[project.id] ?? []
    const { totalKeys, approvedByLocale } = statsByProject.get(project.id) ?? { totalKeys: 0, approvedByLocale: new Map() }
    const localesWithStats = computeLocaleStatsFromApproved(locales, approvedByLocale, totalKeys)
    const overallPercent = computeOverallPercent(localesWithStats, totalKeys)
    return { ...project, key_count: totalKeys, locale_count: locales.length, overall_percent: overallPercent, locales: localesWithStats } satisfies ProjectWithStats
  })
}

// Cached per server request: a heavy ProjectWithStats build, deduped if the
// same project is read more than once during a single render.
export const getProject = cache(async (projectId: string): Promise<ProjectWithStats | null> => {
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) return null

  const { data: localeRows } = await supabase.from('locales').select('*').eq('project_id', projectId)
  const locales = localeRows ?? []
  const { totalKeys, approvedByLocale } = await getDefaultBranchStats(supabase, projectId, locales)
  const localesWithStats = computeLocaleStatsFromApproved(locales, approvedByLocale, totalKeys)
  const overallPercent = computeOverallPercent(localesWithStats, totalKeys)

  return { ...project, key_count: totalKeys, locale_count: locales.length, overall_percent: overallPercent, locales: localesWithStats } satisfies ProjectWithStats
})

// Lightweight project read for the editor shell. The editor already receives
// the active branch's key count separately, and only needs locale metadata for
// grid rendering/status logic. Avoid default-branch progress stats here because
// those require extra count queries and sit on the first paint path.
export const getProjectLite = cache(async (projectId: string): Promise<ProjectWithStats | null> => {
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) return null

  const { data: localeRows } = await supabase.from('locales').select('*').eq('project_id', projectId)
  const locales = localeRows ?? []

  return {
    ...project,
    key_count: 0,
    locale_count: locales.length,
    overall_percent: 0,
    locales: computeEmptyLocaleStats(locales),
  } satisfies ProjectWithStats
})

// ── Writes: admin client (service role) ──────────────────────────────────
// API routes verify auth via getUser() before calling these functions.
// Admin client is correct here: server-side code is trusted, and RLS
// creates a chicken-and-egg problem (e.g. org must exist before member,
// but project INSERT policy requires membership).

export async function createProject(data: {
  orgId: string; userId: string; name: string; description?: string; baseLocale: string; baseLocaleName?: string
}): Promise<{ id: string; slug: string } | { error: string }> {
  const admin = createAdminClient()
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const { data: project, error: projectError } = await admin
    .from('projects')
    .insert({
      org_id: data.orgId, name: data.name, slug, base_locale: data.baseLocale,
      ...(data.description ? { description: data.description } : {}),
    })
    .select('id, slug').single()

  if (projectError || !project) return { error: projectError?.message ?? 'Failed to create project' }

  // Every project needs a default "main" branch (M1/M2 branching). Without it
  // resolveBranchId returns null and the editor 404s.
  const { error: branchError } = await admin.from('branches').insert({
    project_id: project.id, name: 'main', is_default: true, created_by: data.userId,
  })
  if (branchError) {
    await admin.from('projects').delete().eq('id', project.id)
    return { error: branchError.message }
  }

  await admin.from('locales').insert({
    project_id: project.id, code: data.baseLocale,
    name: data.baseLocaleName ?? LOCALE_NAMES[data.baseLocale] ?? data.baseLocale.toUpperCase(), is_base: true,
  })

  return { id: project.id, slug: project.slug }
}

export async function updateProject(
  projectId: string, data: { name?: string; description?: string }
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient()
  const updateData: Database['public']['Tables']['projects']['Update'] = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  const { error } = await admin.from('projects').update(updateData).eq('id', projectId)
  return error ? { error: error.message } : { success: true }
}

export async function deleteProject(projectId: string): Promise<{ success: true }> {
  const admin = createAdminClient()
  await admin.from('projects').delete().eq('id', projectId)
  return { success: true }
}

export async function addLocale(
  projectId: string, code: string, name: string
): Promise<{ locale?: { id: string; code: string; name: string; is_base: boolean }; error?: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('locales')
    .insert({ project_id: projectId, code, name, is_base: false })
    .select('id, code, name, is_base')
    .single()
  return error ? { error: error.message } : { locale: data ? { ...data, is_base: data.is_base ?? false } : undefined }
}

export async function removeLocale(localeId: string): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('locales').delete().eq('id', localeId)
  return error ? { error: error.message } : {}
}
