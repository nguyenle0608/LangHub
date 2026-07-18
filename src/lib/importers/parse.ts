import { deriveNamespaceFromFilename, prefixKeysWithNamespace, sanitizeNamespaceSegment, type JsonImportStructure } from '@/lib/localization-namespaces'
import { parseAndroidXML } from '@/lib/parsers/android'
import { parseARB } from '@/lib/parsers/arb'
import { parseCSV } from '@/lib/parsers/csv'
import { parseIOSStrings } from '@/lib/parsers/ios'
import { parseJSON } from '@/lib/parsers/json'
import { parseYAML } from '@/lib/parsers/yaml'

export const IMPORT_FORMATS = ['json', 'arb', 'csv', 'yaml', 'yml', 'android', 'ios'] as const
export type ImportFormat = typeof IMPORT_FORMATS[number]
export const MAX_PUBLIC_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_KEYS = 5000
export const MAX_IMPORT_KEY_LENGTH = 200
export const MAX_IMPORT_VALUE_LENGTH = 100_000

export class ImportValidationError extends Error {
  constructor(message: string, public code: 'format' | 'content' | 'bounds' | 'resource' = 'content') {
    super(message)
    this.name = 'ImportValidationError'
  }
}

export interface ParsedImport {
  entries: Array<{ key: string; value: string }>
  warnings: string[]
}

export function isImportFile(value: FormDataEntryValue | null): value is File {
  return value !== null
    && typeof value !== 'string'
    && typeof value.name === 'string'
    && typeof value.size === 'number'
    && typeof value.text === 'function'
}

export function parseImportContent(input: {
  content: string
  filename: string
  format: ImportFormat
  localeCode?: string
  namespace?: string | null
  importStructure?: JsonImportStructure
}): ParsedImport {
  const { content, filename, format } = input
  if (!filename || filename.length > 255) throw new ImportValidationError('Filename must contain 1 to 255 characters', 'bounds')
  let result
  if (format === 'json') result = parseJSON(content)
  else if (format === 'arb') result = parseARB(content)
  else if (format === 'yaml' || format === 'yml') result = parseYAML(content)
  else if (format === 'android') result = parseAndroidXML(content)
  else if (format === 'ios') result = parseIOSStrings(content)
  else {
    const results = parseCSV(content)
    result = results.find((candidate) => candidate.locale === input.localeCode) ?? results[0]
    if (!result) throw new ImportValidationError('No matching locale found in CSV')
  }
  if (result.errors.length) throw new ImportValidationError(result.errors[0] ?? 'Invalid import file', 'format')

  let keys = result.keys
  const namespace = input.namespace?.trim() || null
  if (format === 'json' && (input.importStructure ?? 'monolithic') === 'namespaced') {
    const effective = sanitizeNamespaceSegment(namespace ?? deriveNamespaceFromFilename(filename))
    if (!effective) throw new ImportValidationError('Namespace is required for namespaced JSON import')
    keys = prefixKeysWithNamespace(keys, effective)
  } else if (namespace) {
    const effective = sanitizeNamespaceSegment(namespace)
    if (!effective) throw new ImportValidationError('Namespace is invalid')
    keys = prefixKeysWithNamespace(keys, effective)
  }

  const entries = Object.entries(keys).map(([key, value]) => ({ key, value }))
  validateImportEntries(entries)
  return { entries, warnings: result.warnings }
}

export function validateImportEntries(entries: Array<{ key: string; value: string }>) {
  if (entries.length === 0) throw new ImportValidationError('No keys found in file')
  if (entries.length > MAX_IMPORT_KEYS) throw new ImportValidationError(`Import exceeds the ${MAX_IMPORT_KEYS} key limit`, 'bounds')
  for (const entry of entries) {
    if (!entry.key || entry.key.length > MAX_IMPORT_KEY_LENGTH || !/^[a-z0-9_.]+$/.test(entry.key)) {
      throw new ImportValidationError(`Invalid translation key: ${entry.key.slice(0, 50)}`, 'bounds')
    }
    if (entry.value.length > MAX_IMPORT_VALUE_LENGTH) {
      throw new ImportValidationError(`Value for ${entry.key} exceeds ${MAX_IMPORT_VALUE_LENGTH} characters`, 'bounds')
    }
  }
}

export function assertImportBodySize(byteLength: number, maxBytes = MAX_PUBLIC_IMPORT_BYTES) {
  if (byteLength > maxBytes) throw new ImportValidationError(`Import exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MiB limit`, 'bounds')
}
