import { cache } from 'react'
import { createClient } from '../server'
import { createAdminClient } from '../admin'
import { fetchBranchTranslations } from '@/lib/branches/fetch'
import type { Database } from '@/types/database'
import type { LocaleWithStats, ProjectWithStats } from '@/types'

type LocaleRow = Database['public']['Tables']['locales']['Row']
type TranslationRow = Database['public']['Tables']['translations']['Row']

const LOCALE_NAMES: Record<string, string> = {
  en: 'English', vi: 'Tiếng Việt', ja: '日本語', ko: '한국어',
  zh: '中文', fr: 'Français', de: 'Deutsch', es: 'Español',
  pt: 'Português', th: 'ภาษาไทย', id: 'Bahasa Indonesia',
}

function computeLocaleStats(
  locales: LocaleRow[],
  translations: Pick<TranslationRow, 'locale_id' | 'status'>[],
  totalKeys: number
): LocaleWithStats[] {
  return locales.map((locale) => {
    const localeTrans = translations.filter((t) => t.locale_id === locale.id)
    const approved = localeTrans.filter((t) => t.status === 'approved').length
    const percent = totalKeys > 0 ? Math.round((approved / totalKeys) * 100) : 0
    return { id: locale.id, code: locale.code, name: locale.name, is_base: locale.is_base ?? false, total: totalKeys, approved, percent }
  })
}

function computeOverallPercent(localesWithStats: LocaleWithStats[], totalKeys: number): number {
  const nonBase = localesWithStats.filter((l) => !l.is_base)
  const overallApproved = nonBase.reduce((sum, l) => sum + l.approved, 0)
  const overallTotal = totalKeys * nonBase.length
  return overallTotal > 0 ? Math.round((overallApproved / overallTotal) * 100) : 0
}

async function getProjectTranslations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
): Promise<{ totalKeys: number; translations: Pick<TranslationRow, 'locale_id' | 'status'>[] }> {
  // Project-level stats reflect the default (main) branch only. Keys are
  // per-branch (M2), so both the key count and translations are scoped to main.
  const { data: mainBranch } = await supabase
    .from('branches').select('id').eq('project_id', projectId).eq('is_default', true).maybeSingle()
  if (!mainBranch) return { totalKeys: 0, translations: [] }

  const { count } = await supabase
    .from('translation_keys')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', mainBranch.id)

  const totalKeys = count ?? 0
  if (totalKeys === 0) return { totalKeys: 0, translations: [] }

  const translations = await fetchBranchTranslations(supabase, mainBranch.id)
  return { totalKeys, translations }
}

type ProjectStats = { totalKeys: number; translations: Pick<TranslationRow, 'locale_id' | 'status'>[] }

// Batched stats for a list of projects. Collapses the per-project 3-query
// pattern (branch + key count + translations) into ~3 queries total by
// resolving all default branches at once and grouping rows in memory.
async function getProjectsTranslationStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectIds: string[]
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
  for (const pid of projectIds) result.set(pid, { totalKeys: 0, translations: [] })
  if (!branchIds.length) return result

  const PAGE = 1000

  // 2. Key counts per branch (only branch_id column; paginated).
  const keyCountByBranch = new Map<string, number>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('translation_keys')
      .select('branch_id')
      .in('branch_id', branchIds)
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    for (const row of data) {
      if (row.branch_id) keyCountByBranch.set(row.branch_id, (keyCountByBranch.get(row.branch_id) ?? 0) + 1)
    }
    if (data.length < PAGE) break
  }

  // 3. Translations for all branches (status/locale only; paginated).
  const transByBranch = new Map<string, Pick<TranslationRow, 'locale_id' | 'status'>[]>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('translations')
      .select('branch_id, locale_id, status')
      .in('branch_id', branchIds)
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    for (const row of data) {
      if (!row.branch_id) continue
      const list = transByBranch.get(row.branch_id) ?? []
      list.push({ locale_id: row.locale_id, status: row.status })
      transByBranch.set(row.branch_id, list)
    }
    if (data.length < PAGE) break
  }

  for (const [branchId, projectId] of Array.from(branchToProject)) {
    result.set(projectId, {
      totalKeys: keyCountByBranch.get(branchId) ?? 0,
      translations: transByBranch.get(branchId) ?? [],
    })
  }
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

  const statsByProject = await getProjectsTranslationStats(supabase, projectRows.map((p) => p.id))

  return projectRows.map((project) => {
    const locales = localesByProject[project.id] ?? []
    const { totalKeys, translations } = statsByProject.get(project.id) ?? { totalKeys: 0, translations: [] }
    const localesWithStats = computeLocaleStats(locales, translations, totalKeys)
    const overallPercent = computeOverallPercent(localesWithStats, totalKeys)
    return { ...project, key_count: totalKeys, locale_count: locales.length, overall_percent: overallPercent, locales: localesWithStats } satisfies ProjectWithStats
  })
}

export async function getProjectsByOrg(orgId: string): Promise<ProjectWithStats[]> {
  const supabase = await createClient()

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

  const statsByProject = await getProjectsTranslationStats(supabase, projectRows.map((p) => p.id))

  return projectRows.map((project) => {
    const locales = localesByProject[project.id] ?? []
    const { totalKeys, translations } = statsByProject.get(project.id) ?? { totalKeys: 0, translations: [] }
    const localesWithStats = computeLocaleStats(locales, translations, totalKeys)
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
  const { totalKeys, translations } = await getProjectTranslations(supabase, projectId)
  const localesWithStats = computeLocaleStats(locales, translations, totalKeys)
  const overallApproved = localesWithStats.reduce((sum, l) => sum + l.approved, 0)
  const overallTotal = totalKeys * locales.length
  const overallPercent = overallTotal > 0 ? Math.round((overallApproved / overallTotal) * 100) : 0

  return { ...project, key_count: totalKeys, locale_count: locales.length, overall_percent: overallPercent, locales: localesWithStats } satisfies ProjectWithStats
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
