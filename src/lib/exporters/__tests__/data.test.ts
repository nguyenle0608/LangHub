import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/types/database'
import {
  buildExportLookup,
  ExportDataQueryError,
  fetchExportData,
  type ExportKey,
  type ExportTranslation,
} from '../data'
import { exportJSON } from '../json'

type MockRow = Record<string, unknown>
type MockTable = { rows: MockRow[]; failAtFrom?: number }

function createMockClient(tables: Record<string, MockTable>) {
  const calls = {
    ranges: [] as Array<{ table: string; from: number; to: number }>,
    inColumns: [] as string[],
  }

  class MockQuery {
    private filters: Array<(row: MockRow) => boolean> = []
    private orderColumn: string | null = null

    constructor(private tableName: string) {}

    select() { return this }

    eq(column: string, value: unknown) {
      this.filters.push((row) => row[column] === value)
      return this
    }

    in(column: string, values: unknown[]) {
      calls.inColumns.push(column)
      const allowed = new Set(values)
      this.filters.push((row) => allowed.has(row[column]))
      return this
    }

    order(column: string) {
      this.orderColumn = column
      return this
    }

    async range(from: number, to: number) {
      calls.ranges.push({ table: this.tableName, from, to })
      const table = tables[this.tableName]!
      if (table.failAtFrom === from) {
        return { data: null, error: { message: `${this.tableName} page failed` } }
      }

      let rows = table.rows.filter((row) => this.filters.every((filter) => filter(row)))
      if (this.orderColumn) {
        const column = this.orderColumn
        rows = [...rows].sort((a, b) => String(a[column]).localeCompare(String(b[column])))
      }
      return { data: rows.slice(from, to + 1), error: null }
    }
  }

  const client = {
    from(tableName: string) {
      return new MockQuery(tableName)
    },
  } as unknown as SupabaseClient<Database>

  return { client, calls }
}

function keyRows(count: number): MockRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `key-${String(index).padStart(4, '0')}`,
    branch_id: 'branch-main',
    key: `messages.key_${index}`,
    description: null,
  }))
}

function translationRows(count: number, localeId = 'locale-en'): MockRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `translation-${String(index).padStart(4, '0')}`,
    branch_id: 'branch-main',
    key_id: `key-${String(index).padStart(4, '0')}`,
    locale_id: localeId,
    value: `Value ${index}`,
    status: index % 2 === 0 ? 'approved' : 'pending',
  }))
}

describe('fetchExportData', () => {
  it('loads 600+ populated keys and translations across bounded pages', async () => {
    const { client, calls } = createMockClient({
      translation_keys: { rows: keyRows(650) },
      translations: { rows: translationRows(650) },
    })

    const result = await fetchExportData(client, 'branch-main', ['locale-en'])

    expect(result.keys).toHaveLength(650)
    expect(result.translations).toHaveLength(650)
    expect(calls.ranges.filter((call) => call.table === 'translation_keys')).toHaveLength(2)
    expect(calls.ranges.filter((call) => call.table === 'translations')).toHaveLength(2)
    expect(calls.inColumns).toEqual(['locale_id', 'locale_id'])
    expect(calls.inColumns).not.toContain('key_id')
  })

  it('loads more than one key page and drops translations outside the branch key set', async () => {
    const rows = translationRows(1001)
    rows.push({
      id: 'translation-orphan', branch_id: 'branch-main', key_id: 'other-branch-key',
      locale_id: 'locale-en', value: 'Must not export', status: 'approved',
    })
    const { client, calls } = createMockClient({
      translation_keys: { rows: keyRows(1001) },
      translations: { rows },
    })

    const result = await fetchExportData(client, 'branch-main', ['locale-en'])

    expect(result.keys).toHaveLength(1001)
    expect(result.translations).toHaveLength(1001)
    expect(calls.ranges.filter((call) => call.table === 'translation_keys')).toHaveLength(3)
  })

  it('aborts instead of returning partial data when a later page fails', async () => {
    const { client } = createMockClient({
      translation_keys: { rows: keyRows(650) },
      translations: { rows: translationRows(650), failAtFrom: 500 },
    })

    await expect(fetchExportData(client, 'branch-main', ['locale-en'])).rejects.toEqual(
      expect.objectContaining<Partial<ExportDataQueryError>>({
        name: 'ExportDataQueryError',
        message: 'Failed to load translations for export: translations page failed',
      })
    )
  })

  it('propagates key page failures before querying translations', async () => {
    const { client, calls } = createMockClient({
      translation_keys: { rows: keyRows(650), failAtFrom: 500 },
      translations: { rows: translationRows(650) },
    })

    await expect(fetchExportData(client, 'branch-main', ['locale-en'])).rejects.toThrow(
      'Failed to load translation keys for export'
    )
    expect(calls.ranges.some((call) => call.table === 'translations')).toBe(false)
  })
})

describe('buildExportLookup', () => {
  const keys: ExportKey[] = [
    { id: 'key-a', key: 'messages.a', description: null },
    { id: 'key-b', key: 'messages.b', description: null },
    { id: 'key-c', key: 'messages.c', description: null },
  ]
  const translations: ExportTranslation[] = [
    { key_id: 'key-a', locale_id: 'locale-en', value: 'A', status: 'approved' },
    { key_id: 'key-b', locale_id: 'locale-en', value: 'B', status: 'pending' },
    { key_id: 'key-c', locale_id: 'locale-en', value: 'C', status: 'reviewed' },
    { key_id: 'key-a', locale_id: 'locale-vi', value: 'Á', status: 'approved' },
  ]

  it('applies status filters across multiple locales', () => {
    const approved = buildExportLookup(keys, translations, 'approved')
    expect(approved.get('locale-en')).toEqual({ 'messages.a': 'A' })
    expect(approved.get('locale-vi')).toEqual({ 'messages.a': 'Á' })

    const reviewedApproved = buildExportLookup(keys, translations, 'reviewed_approved')
    expect(reviewedApproved.get('locale-en')).toEqual({
      'messages.a': 'A',
      'messages.c': 'C',
    })
  })

  it('preserves a valid empty JSON export after successful retrieval', () => {
    const byLocale = buildExportLookup(keys, [], 'all')
    expect(exportJSON(byLocale.get('locale-en') ?? {})).toBe('{}')
  })
})
