import { assertProjectAccess } from '@/lib/auth/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { findApplicableGlossaryTerms, type GlossaryMatchTerm } from './matcher'
import type { TranslationAssistance, TranslationMemorySuggestion } from './types'

interface AssistanceContext {
  userId: string
  projectId: string
  branchId: string
  keyId: string
  targetLocaleId: string
}

export async function getTranslationAssistance(input: AssistanceContext): Promise<TranslationAssistance | null> {
  const access = await assertProjectAccess(input.userId, input.projectId, 'viewer')
  if (!access.ok) return null
  const admin = createAdminClient()

  const [projectResult, branchResult, keyResult, targetLocaleResult] = await Promise.all([
    admin.from('projects').select('base_locale').eq('id', input.projectId).maybeSingle(),
    admin.from('branches').select('id').eq('id', input.branchId).eq('project_id', input.projectId).maybeSingle(),
    admin.from('translation_keys').select('id').eq('id', input.keyId).eq('project_id', input.projectId).eq('branch_id', input.branchId).maybeSingle(),
    admin.from('locales').select('id, code, is_base').eq('id', input.targetLocaleId).eq('project_id', input.projectId).maybeSingle(),
  ])
  const baseLocale = projectResult.data?.base_locale?.toLowerCase()
  const targetLocale = targetLocaleResult.data
  if (!baseLocale || !branchResult.data || !keyResult.data || !targetLocale || targetLocale.is_base) return null

  const { data: baseLocaleRow } = await admin
    .from('locales').select('id, code').eq('project_id', input.projectId).ilike('code', baseLocale).maybeSingle()
  if (!baseLocaleRow) return null

  const { data: sourceTranslation, error: sourceError } = await admin
    .from('translations').select('value')
    .eq('branch_id', input.branchId).eq('key_id', input.keyId).eq('locale_id', baseLocaleRow.id).maybeSingle()
  const sourceText = sourceTranslation?.value?.trim() ?? ''
  if (sourceError || !sourceText) {
    return { sourceText: '', sourceLocale: baseLocaleRow.code, targetLocale: targetLocale.code, suggestions: [], glossary: [] }
  }

  const [memoryResult, glossaryResult] = await Promise.all([
    admin.rpc('search_translation_memory', {
      p_org_id: access.orgId,
      p_source_locale: baseLocaleRow.code,
      p_target_locale: targetLocale.code,
      p_source_text: sourceText,
      p_limit: 5,
      p_threshold: 0.55,
    }),
    admin.from('glossary_terms')
      .select('id, source_term, target_term, case_sensitive, whole_word, description')
      .eq('org_id', access.orgId)
      .eq('source_locale', baseLocaleRow.code.toLowerCase())
      .eq('target_locale', targetLocale.code.toLowerCase())
      .order('source_normalized', { ascending: true })
      .limit(200),
  ])
  if (memoryResult.error || glossaryResult.error) throw new Error('Failed to load translation assistance')

  const suggestions: TranslationMemorySuggestion[] = (memoryResult.data ?? []).map((row) => ({
    id: row.id,
    sourceText: row.source_text,
    targetText: row.target_text,
    score: Number(row.score),
    matchKind: row.match_kind === 'exact' ? 'exact' : 'fuzzy',
    projectId: row.project_id,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
  }))
  const terms: GlossaryMatchTerm[] = (glossaryResult.data ?? []).map((row) => ({
    id: row.id,
    sourceTerm: row.source_term,
    targetTerm: row.target_term,
    caseSensitive: row.case_sensitive,
    wholeWord: row.whole_word,
    description: row.description,
  }))

  return {
    sourceText,
    sourceLocale: baseLocaleRow.code,
    targetLocale: targetLocale.code,
    suggestions,
    glossary: findApplicableGlossaryTerms(sourceText, terms),
  }
}

export async function recordSuggestionUsage(userId: string, projectId: string, entryId: string): Promise<boolean | null> {
  const access = await assertProjectAccess(userId, projectId, 'translator')
  if (!access.ok) return null
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_translation_memory_usage', {
    p_org_id: access.orgId,
    p_entry_id: entryId,
  })
  return error ? false : data
}
