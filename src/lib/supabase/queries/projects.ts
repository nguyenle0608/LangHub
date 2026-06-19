import { createClient } from '../server'
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
    return {
      id: locale.id,
      code: locale.code,
      name: locale.name,
      is_base: locale.is_base,
      total: totalKeys,
      approved,
      percent,
    }
  })
}

async function getProjectTranslations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
): Promise<{ totalKeys: number; translations: Pick<TranslationRow, 'locale_id' | 'status'>[] }> {
  const { count } = await supabase
    .from('translation_keys')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  const totalKeys = count ?? 0
  if (totalKeys === 0) return { totalKeys: 0, translations: [] }

  const { data: keyRows } = await supabase
    .from('translation_keys')
    .select('id')
    .eq('project_id', projectId)

  const keyIds = (keyRows ?? []).map((k) => k.id)
  if (keyIds.length === 0) return { totalKeys, translations: [] }

  const { data: translations } = await supabase
    .from('translations')
    .select('locale_id, status')
    .in('key_id', keyIds)

  return { totalKeys, translations: translations ?? [] }
}

export async function getProjects(userId: string): Promise<ProjectWithStats[]> {
  const supabase = await createClient()

  const { data: memberships } = await supabase
    .from('members')
    .select('org_id')
    .eq('user_id', userId)

  if (!memberships?.length) return []
  const orgIds = memberships.map((m) => m.org_id).filter((id): id is string => id !== null)
  if (!orgIds.length) return []

  const { data: projectRows } = await supabase
    .from('projects')
    .select('*')
    .in('org_id', orgIds)
    .order('created_at', { ascending: false })

  if (!projectRows?.length) return []

  const { data: localeRows } = await supabase
    .from('locales')
    .select('*')
    .in('project_id', projectRows.map((p) => p.id))

  const localesByProject = (localeRows ?? []).reduce<Record<string, LocaleRow[]>>((acc, l) => {
    const pid = l.project_id ?? ''
    if (pid) {
      acc[pid] = [...(acc[pid] ?? []), l]
    }
    return acc
  }, {})

  return Promise.all(
    projectRows.map(async (project) => {
      const locales = localesByProject[project.id] ?? []
      const { totalKeys, translations } = await getProjectTranslations(supabase, project.id)
      const localesWithStats = computeLocaleStats(locales, translations, totalKeys)

      const overallApproved = localesWithStats.reduce((sum, l) => sum + l.approved, 0)
      const overallTotal = totalKeys * locales.length
      const overallPercent = overallTotal > 0 ? Math.round((overallApproved / overallTotal) * 100) : 0

      return {
        ...project,
        key_count: totalKeys,
        locale_count: locales.length,
        overall_percent: overallPercent,
        locales: localesWithStats,
      } satisfies ProjectWithStats
    })
  )
}

export async function getProject(projectId: string): Promise<ProjectWithStats | null> {
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) return null

  const { data: localeRows } = await supabase
    .from('locales')
    .select('*')
    .eq('project_id', projectId)

  const locales = localeRows ?? []
  const { totalKeys, translations } = await getProjectTranslations(supabase, projectId)
  const localesWithStats = computeLocaleStats(locales, translations, totalKeys)

  const overallApproved = localesWithStats.reduce((sum, l) => sum + l.approved, 0)
  const overallTotal = totalKeys * locales.length
  const overallPercent = overallTotal > 0 ? Math.round((overallApproved / overallTotal) * 100) : 0

  return {
    ...project,
    key_count: totalKeys,
    locale_count: locales.length,
    overall_percent: overallPercent,
    locales: localesWithStats,
  } satisfies ProjectWithStats
}

export async function createProject(data: {
  userId: string
  name: string
  description?: string
  baseLocale: string
}): Promise<{ id: string; slug: string } | { error: string }> {
  const supabase = await createClient()
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: data.name, slug: `${slug}-${Date.now()}`, plan: 'free' })
    .select('id')
    .single()

  if (orgError || !org) return { error: orgError?.message ?? 'Failed to create org' }

  await supabase.from('members').insert({
    org_id: org.id,
    user_id: data.userId,
    role: 'owner',
  })

  const insertData: Database['public']['Tables']['projects']['Insert'] = {
    org_id: org.id,
    name: data.name,
    slug,
    base_locale: data.baseLocale,
    ...(data.description ? { description: data.description } : {}),
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert(insertData)
    .select('id, slug')
    .single()

  if (projectError || !project) return { error: projectError?.message ?? 'Failed to create project' }

  await supabase.from('locales').insert({
    project_id: project.id,
    code: data.baseLocale,
    name: LOCALE_NAMES[data.baseLocale] ?? data.baseLocale.toUpperCase(),
    is_base: true,
  })

  return { id: project.id, slug: project.slug }
}

export async function updateProject(
  projectId: string,
  data: { name?: string; description?: string }
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const updateData: Database['public']['Tables']['projects']['Update'] = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description

  const { error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', projectId)

  return error ? { error: error.message } : { success: true }
}

export async function deleteProject(projectId: string): Promise<{ success: true }> {
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('org_id')
    .eq('id', projectId)
    .single()

  if (project?.org_id) {
    await supabase.from('organizations').delete().eq('id', project.org_id)
  }
  return { success: true }
}

export async function addLocale(
  projectId: string,
  code: string,
  name: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('locales').insert({
    project_id: projectId,
    code,
    name,
    is_base: false,
  })
  return error ? { error: error.message } : {}
}

export async function removeLocale(localeId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('locales').delete().eq('id', localeId)
  return error ? { error: error.message } : {}
}
