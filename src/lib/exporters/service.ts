import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { splitKeysByNamespace, type JsonExportStructure } from '@/lib/localization-namespaces'
import { exportAndroidXML } from './android'
import { exportARB } from './arb'
import { exportCSV } from './csv'
import { buildExportLookup, fetchExportData, type ExportFilter } from './data'
import { exportIOSStrings } from './ios'
import { exportJSON } from './json'
import { exportYAML } from './yaml'
import { exportZIP } from './zip'

export type ExportFormat = 'json' | 'arb' | 'csv' | 'yaml' | 'android' | 'ios'

export interface ExportCommand {
  projectId: string
  branchId: string
  localeIds: string[]
  format: ExportFormat
  filter: ExportFilter
  nested?: boolean
  jsonStructure?: JsonExportStructure
  includeEmpty?: boolean
}

export interface ExportArtifact {
  body: string | Buffer
  contentType: string
  filename: string
}

export class ExportServiceError extends Error {
  constructor(public code: 'no_keys' | 'no_locales' | 'query_failed', message: string) {
    super(message)
    this.name = 'ExportServiceError'
  }
}

function safeFilenameSegment(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return safe || 'locale'
}

export async function executeExport(
  client: SupabaseClient<Database>,
  command: ExportCommand
): Promise<ExportArtifact> {
  const {
    projectId, branchId, localeIds, format, filter,
    nested = true, jsonStructure = 'monolithic', includeEmpty = false,
  } = command
  const { keys, translations } = await fetchExportData(client, branchId, localeIds)
  if (!keys.length) throw new ExportServiceError('no_keys', 'No keys found')

  const { data: localeRows, error: localesError } = await client
    .from('locales')
    .select('id, code, name')
    .eq('project_id', projectId)
    .in('id', localeIds)
  if (localesError) throw new ExportServiceError('query_failed', `Failed to load locales for export: ${localesError.message}`)
  if (!localeRows?.length || localeRows.length !== new Set(localeIds).size) {
    throw new ExportServiceError('no_locales', 'No locales found')
  }
  const localeOrder = new Map(localeIds.map((id, index) => [id, index]))
  const locales = [...localeRows].sort((a, b) => (localeOrder.get(a.id) ?? 0) - (localeOrder.get(b.id) ?? 0))
  const byLocale = buildExportLookup(keys, translations, filter, { includeEmpty, localeIds })
  const descriptions = Object.fromEntries(keys.filter((key) => key.description).map((key) => [key.key, key.description as string]))

  if (format === 'csv') {
    const keyNames = keys.map((key) => key.key)
    const localeCodes = locales.map((locale) => locale.code)
    const values: Record<string, Record<string, string>> = {}
    for (const key of keyNames) {
      values[key] = Object.fromEntries(locales.map((locale) => [locale.code, byLocale.get(locale.id)?.[key] ?? '']))
    }
    return {
      body: exportCSV(keyNames, localeCodes, values), contentType: 'text/csv',
      filename: `translations-${localeCodes.map(safeFilenameSegment).join('-')}.csv`,
    }
  }

  if (locales.length === 1) {
    const locale = locales[0]!
    const safeLocaleCode = safeFilenameSegment(locale.code)
    const localeKeys = byLocale.get(locale.id) ?? {}
    if (format === 'json' && jsonStructure === 'namespaced') {
      const files = splitKeysByNamespace(localeKeys).map((group) => ({ name: group.filename, content: exportJSON(group.keys, true) }))
      return { body: await exportZIP(files), contentType: 'application/zip', filename: `${safeLocaleCode}-namespaces.zip` }
    }
    if (format === 'json') return { body: exportJSON(localeKeys, nested), contentType: 'application/json', filename: `${safeLocaleCode}.json` }
    if (format === 'arb') return { body: exportARB(localeKeys, locale.code, descriptions), contentType: 'application/json', filename: `${safeLocaleCode}.arb` }
    if (format === 'yaml') return { body: exportYAML(localeKeys), contentType: 'text/yaml', filename: `${safeLocaleCode}.yaml` }
    if (format === 'android') return { body: exportAndroidXML(localeKeys), contentType: 'application/xml', filename: 'strings.xml' }
    return { body: exportIOSStrings(localeKeys), contentType: 'text/plain', filename: 'Localizable.strings' }
  }

  const files: Array<{ name: string; content: string }> = []
  for (const locale of locales) {
    const localeKeys = byLocale.get(locale.id) ?? {}
    const safeLocaleCode = safeFilenameSegment(locale.code)
    if (format === 'json' && jsonStructure === 'namespaced') {
      files.push(...splitKeysByNamespace(localeKeys).map((group) => ({ name: `${safeLocaleCode}/${group.filename}`, content: exportJSON(group.keys, true) })))
    } else if (format === 'json') files.push({ name: `${safeLocaleCode}.json`, content: exportJSON(localeKeys, nested) })
    else if (format === 'arb') files.push({ name: `${safeLocaleCode}.arb`, content: exportARB(localeKeys, locale.code, descriptions) })
    else if (format === 'android') files.push({ name: `values-${safeLocaleCode}/strings.xml`, content: exportAndroidXML(localeKeys) })
    else if (format === 'ios') files.push({ name: `${safeLocaleCode}.lproj/Localizable.strings`, content: exportIOSStrings(localeKeys) })
    else files.push({ name: `${safeLocaleCode}.yaml`, content: exportYAML(localeKeys) })
  }
  return { body: await exportZIP(files), contentType: 'application/zip', filename: 'translations.zip' }
}
