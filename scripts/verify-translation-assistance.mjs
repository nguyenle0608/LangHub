import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing Supabase service configuration')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const suffix = randomUUID().slice(0, 8)
const sourceText = `Deploy settings safely ${suffix}`
const targetText = `Triển khai cài đặt an toàn ${suffix}`
let projectId = null
let glossaryId = null

function value(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

try {
  const organizations = value(await db.from('organizations').select('id').order('created_at').limit(2), 'organizations')
  if (!organizations?.[0]) throw new Error('No organization available for smoke test')
  const orgId = organizations[0].id
  const foreignOrgId = organizations[1]?.id ?? null

  projectId = value(await db.from('projects').insert({ org_id: orgId, name: `TM smoke ${suffix}`, slug: `tm-smoke-${suffix}`, base_locale: 'en' }).select('id').single(), 'project').id
  const branchId = value(await db.from('branches').insert({ project_id: projectId, name: 'main', is_default: true }).select('id').single(), 'branch').id
  const locales = value(await db.from('locales').insert([
    { project_id: projectId, code: 'en', name: 'English', is_base: true },
    { project_id: projectId, code: 'vi', name: 'Vietnamese', is_base: false },
  ]).select('id, code'), 'locales')
  const sourceLocaleId = locales.find((locale) => locale.code === 'en').id
  const targetLocaleId = locales.find((locale) => locale.code === 'vi').id
  const keyId = value(await db.from('translation_keys').insert({ project_id: projectId, branch_id: branchId, key: `smoke.${suffix}` }).select('id').single(), 'key').id
  value(await db.from('translations').insert({ branch_id: branchId, key_id: keyId, locale_id: sourceLocaleId, value: sourceText, status: 'approved' }), 'source translation')
  value(await db.from('translations').insert({ branch_id: branchId, key_id: keyId, locale_id: targetLocaleId, value: targetText, status: 'approved' }), 'target translation')

  const exact = value(await db.rpc('search_translation_memory', { p_org_id: orgId, p_source_locale: 'en', p_target_locale: 'vi', p_source_text: sourceText, p_limit: 5, p_threshold: 0.55 }), 'exact search')
  if (exact?.[0]?.match_kind !== 'exact' || exact[0].target_text !== targetText) throw new Error('Exact TM search failed')
  const recorded = value(await db.rpc('record_translation_memory_usage', { p_org_id: orgId, p_entry_id: exact[0].id }), 'usage record')
  if (!recorded) throw new Error('Suggestion usage was not recorded')
  const usage = value(await db.from('translation_memory_entries').select('usage_count, last_used_at').eq('id', exact[0].id).single(), 'usage read')
  if (usage.usage_count < 1 || !usage.last_used_at) throw new Error('Suggestion usage metadata is missing')
  const fuzzy = value(await db.rpc('search_translation_memory', { p_org_id: orgId, p_source_locale: 'en', p_target_locale: 'vi', p_source_text: `Deploy setting safely ${suffix}`, p_limit: 5, p_threshold: 0.55 }), 'fuzzy search')
  if (!fuzzy?.some((row) => row.id === exact[0].id && row.match_kind === 'fuzzy')) throw new Error('Fuzzy TM search failed')
  const short = value(await db.rpc('search_translation_memory', { p_org_id: orgId, p_source_locale: 'en', p_target_locale: 'vi', p_source_text: 'De', p_limit: 5, p_threshold: 0.3 }), 'short search')
  if (short.length !== 0) throw new Error('Short source unexpectedly returned fuzzy results')
  if (foreignOrgId) {
    const foreign = value(await db.rpc('search_translation_memory', { p_org_id: foreignOrgId, p_source_locale: 'en', p_target_locale: 'vi', p_source_text: sourceText, p_limit: 5, p_threshold: 0.3 }), 'foreign search')
    if (foreign.some((row) => row.id === exact[0].id)) throw new Error('Cross-organization TM leak')
  }

  glossaryId = value(await db.from('glossary_terms').insert({
    org_id: orgId, source_locale: 'en', target_locale: 'vi', source_term: `Workspace ${suffix}`,
    source_normalized: `workspace ${suffix}`, target_term: `Không gian ${suffix}`,
  }).select('id').single(), 'glossary insert').id
  const glossary = value(await db.from('glossary_terms').select('id').eq('id', glossaryId).eq('org_id', orgId).single(), 'glossary read')
  if (glossary.id !== glossaryId) throw new Error('Glossary read failed')

  console.log(JSON.stringify({ exact: true, fuzzy: true, shortSource: true, tenantScoped: true, usage: true, glossaryCrud: true }))
} finally {
  if (glossaryId) await db.from('glossary_terms').delete().eq('id', glossaryId)
  if (projectId) await db.from('projects').delete().eq('id', projectId)
  await db.from('translation_memory_entries').delete().eq('source_text', sourceText).eq('target_text', targetText)
}
