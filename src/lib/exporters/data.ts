import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type KeyRow = Database['public']['Tables']['translation_keys']['Row']
type TranslationRow = Database['public']['Tables']['translations']['Row']

export type ExportKey = Pick<KeyRow, 'id' | 'key' | 'description'>
export type ExportTranslation = Pick<TranslationRow, 'key_id' | 'locale_id' | 'value' | 'status'>
export type ExportFilter = 'all' | 'approved' | 'reviewed_approved'

type QueryError = { message: string }
type PageResult<T> = { data: T[] | null; error: QueryError | null }

const EXPORT_PAGE_SIZE = 500

export class ExportDataQueryError extends Error {
  constructor(resource: string, message: string) {
    super(`Failed to load ${resource} for export: ${message}`)
    this.name = 'ExportDataQueryError'
  }
}

export async function loadAllPages<T>(
  resource: string,
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = EXPORT_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await loadPage(from, from + pageSize - 1)
    if (error) throw new ExportDataQueryError(resource, error.message)

    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}

export async function fetchExportData(
  client: SupabaseClient<Database>,
  branchId: string,
  localeIds: string[]
): Promise<{ keys: ExportKey[]; translations: ExportTranslation[] }> {
  const keys = await loadAllPages<ExportKey>('translation keys', (from, to) =>
    client
      .from('translation_keys')
      .select('id, key, description')
      .eq('branch_id', branchId)
      .order('id', { ascending: true })
      .range(from, to)
  )

  const translations = await loadAllPages<ExportTranslation>('translations', (from, to) =>
    client
      .from('translations')
      .select('key_id, locale_id, value, status')
      .eq('branch_id', branchId)
      .in('locale_id', localeIds)
      .order('id', { ascending: true })
      .range(from, to)
  )

  const branchKeyIds = new Set(keys.map((key) => key.id))
  return {
    keys,
    translations: translations.filter(
      (translation) => translation.key_id !== null && branchKeyIds.has(translation.key_id)
    ),
  }
}

export function buildExportLookup(
  keys: ExportKey[],
  translations: ExportTranslation[],
  filter: ExportFilter,
  options?: { includeEmpty?: boolean; localeIds?: string[] }
): Map<string, Record<string, string>> {
  const keyNames = new Map(keys.map((key) => [key.id, key.key]))
  const byLocale = new Map<string, Record<string, string>>()

  if (options?.includeEmpty) {
    for (const localeId of options.localeIds ?? []) {
      byLocale.set(localeId, Object.fromEntries(keys.map((key) => [key.key, ''])))
    }
  }

  for (const translation of translations) {
    if (!translation.key_id || !translation.locale_id) continue
    if (filter === 'approved' && translation.status !== 'approved') continue
    if (
      filter === 'reviewed_approved' &&
      translation.status !== 'approved' &&
      translation.status !== 'reviewed'
    ) continue

    const keyName = keyNames.get(translation.key_id)
    if (!keyName) continue
    if (!byLocale.has(translation.locale_id)) byLocale.set(translation.locale_id, {})
    if (!options?.includeEmpty && !translation.value) continue
    byLocale.get(translation.locale_id)![keyName] = translation.value ?? ''
  }

  return byLocale
}
