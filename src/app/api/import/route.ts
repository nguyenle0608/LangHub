import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSnapshot } from '@/lib/versions/snapshot'
import { resolveBranchId } from '@/lib/branches/queries'
import { parseJSON } from '@/lib/parsers/json'
import { parseARB } from '@/lib/parsers/arb'
import { parseCSV } from '@/lib/parsers/csv'
import { parseYAML } from '@/lib/parsers/yaml'
import {
  deriveNamespaceFromFilename,
  prefixKeysWithNamespace,
  sanitizeNamespaceSegment,
  type JsonImportStructure,
} from '@/lib/localization-namespaces'

const SUPPORTED_FORMATS = ['json', 'arb', 'csv', 'yaml', 'yml'] as const

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('projectId') as string | null
  const localeId = formData.get('localeId') as string | null
  const format = formData.get('format') as string | null
  const snapshotName = formData.get('snapshotName') as string | null
  const branchParam = formData.get('branchId') as string | null
  const namespace = (formData.get('namespace') as string | null)?.trim() || null
  const importStructure = (formData.get('importStructure') as JsonImportStructure | null) ?? 'monolithic'
  const skipAutoSnapshot = formData.get('skipAutoSnapshot') === 'true'
  const skipKeysRaw = formData.get('skipKeys') as string | null
  const skipKeySet = skipKeysRaw ? new Set(JSON.parse(skipKeysRaw) as string[]) : null

  if (!file || !projectId || !localeId || !format) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const branchId = await resolveBranchId(projectId, branchParam)
  if (!branchId) return NextResponse.json({ error: 'No branch found for project' }, { status: 400 })
  if (!SUPPORTED_FORMATS.includes(format as typeof SUPPORTED_FORMATS[number])) {
    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 })
  }
  if (importStructure !== 'monolithic' && importStructure !== 'namespaced') {
    return NextResponse.json({ error: `Unsupported import structure: ${importStructure}` }, { status: 400 })
  }

  const content = await file.text()
  const admin = createAdminClient()

  // 1. Parse file
  let parsedKeys: Record<string, string> = {}
  if (format === 'json') {
    const r = parseJSON(content)
    if (r.errors.length > 0) return NextResponse.json({ error: r.errors[0] }, { status: 400 })
    parsedKeys = r.keys
  } else if (format === 'arb') {
    const r = parseARB(content)
    if (r.errors.length > 0) return NextResponse.json({ error: r.errors[0] }, { status: 400 })
    parsedKeys = r.keys
  } else if (format === 'csv') {
    const { data: locale } = await admin.from('locales').select('code').eq('id', localeId).single()
    const results = parseCSV(content)
    const matching = results.find((r) => r.locale === locale?.code) ?? results[0]
    if (!matching) return NextResponse.json({ error: 'No matching locale found in CSV' }, { status: 400 })
    if (matching.errors.length > 0) return NextResponse.json({ error: matching.errors[0] }, { status: 400 })
    parsedKeys = matching.keys
  } else if (format === 'yaml' || format === 'yml') {
    const r = parseYAML(content)
    if (r.errors.length > 0) return NextResponse.json({ error: r.errors[0] }, { status: 400 })
    parsedKeys = r.keys
  }

  // Apply explicit JSON namespace transformation. Legacy namespace prefixes are
  // still honored for monolithic imports, but namespaced JSON defaults to the
  // file basename so re-importing `authen.json` updates `authen.*` keys.
  if (format === 'json' && importStructure === 'namespaced') {
    const effectiveNamespace = sanitizeNamespaceSegment(namespace ?? deriveNamespaceFromFilename(file.name))
    if (!effectiveNamespace) {
      return NextResponse.json({ error: 'Namespace is required for namespaced JSON import' }, { status: 400 })
    }
    parsedKeys = prefixKeysWithNamespace(parsedKeys, effectiveNamespace)
  } else if (namespace) {
    const effectiveNamespace = sanitizeNamespaceSegment(namespace)
    if (!effectiveNamespace) {
      return NextResponse.json({ error: 'Namespace is invalid' }, { status: 400 })
    }
    parsedKeys = prefixKeysWithNamespace(parsedKeys, effectiveNamespace)
  }

  // All keys in the file (including empty values) — used for key creation
  const allEntries = Object.entries(parsedKeys)
  if (allEntries.length === 0) {
    return NextResponse.json({ error: 'No keys found in file' }, { status: 400 })
  }
  // Only non-empty values are written as translations
  const entries = allEntries.filter(([, v]) => v.trim())

  // 2. Auto-snapshot before import (skip for subsequent files in multi-file import)
  let snapshotId: string | undefined
  if (!skipAutoSnapshot) {
    const snapshotResult = await createSnapshot(projectId, user.id, {
      name: snapshotName ?? `Auto: Before import "${file.name}"`,
      tag: 'auto_import',
      branchId,
    })
    snapshotId = 'error' in snapshotResult ? undefined : snapshotResult.id
  }

  // 3. Fetch existing keys (on the active branch) + locales in parallel
  const [{ data: existingKeys }, { data: allLocales }] = await Promise.all([
    admin.from('translation_keys').select('id, key').eq('branch_id', branchId),
    admin.from('locales').select('id').eq('project_id', projectId),
  ])

  const keyMap = new Map<string, string>((existingKeys ?? []).map((k) => [k.key, k.id]))
  const localeIds = (allLocales ?? []).map((l) => l.id)

  // 4. Separate new vs existing keys (based on all keys, including empty-valued ones)
  const newDotKeys = allEntries.filter(([k]) => !keyMap.has(k)).map(([k]) => k)
  const existingEntries = entries.filter(([k]) => keyMap.has(k))
  // skipKeySet: existing keys the user chose NOT to overwrite (from preview checkboxes)
  const skippedCount = skipKeySet ? existingEntries.filter(([k]) => skipKeySet.has(k)).length : 0
  const updatedCount = existingEntries.length - skippedCount

  // 5. Batch insert new translation_keys on the active branch
  if (newDotKeys.length > 0) {
    const CHUNK = 200
    for (let i = 0; i < newDotKeys.length; i += CHUNK) {
      const chunk = newDotKeys.slice(i, i + CHUNK)
      const { data: inserted } = await admin
        .from('translation_keys')
        .insert(chunk.map((key) => ({ project_id: projectId, branch_id: branchId, key, created_by: user.id })))
        .select('id, key')
      for (const row of inserted ?? []) keyMap.set(row.key, row.id)
    }

    // 6. Empty translations for new keys × locales on this branch
    const emptyRows = newDotKeys.flatMap((k) => {
      const keyId = keyMap.get(k)
      if (!keyId) return []
      return localeIds.map((lid) => ({ branch_id: branchId, key_id: keyId, locale_id: lid, value: null, status: 'empty' as const }))
    })
    const TCHUNK = 500
    for (let i = 0; i < emptyRows.length; i += TCHUNK) {
      await admin.from('translations').insert(emptyRows.slice(i, i + TCHUNK))
    }
  }

  // 7. Batch upsert translations for the imported locale (active branch only)
  // Skip keys the user chose not to overwrite (skipKeySet from preview checkboxes)
  const entriesToWrite = skipKeySet
    ? entries.filter(([k]) => !skipKeySet.has(k))
    : entries

  const upsertRows = entriesToWrite.map(([dotKey, value]) => ({
    branch_id: branchId,
    key_id: keyMap.get(dotKey)!,
    locale_id: localeId,
    value,
    status: 'pending' as const,
    updated_at: new Date().toISOString(),
  })).filter((r) => r.key_id)

  const upsertedIds: string[] = []
  const UCHUNK = 200
  for (let i = 0; i < upsertRows.length; i += UCHUNK) {
    const { data } = await admin
      .from('translations')
      .upsert(upsertRows.slice(i, i + UCHUNK), { onConflict: 'branch_id,key_id,locale_id' })
      .select('id')
    for (const row of data ?? []) upsertedIds.push(row.id)
  }

  // 8. Batch insert history
  if (upsertedIds.length > 0) {
    const historyRows = upsertedIds.map((id) => ({
      translation_id: id,
      old_value: null,
      new_value: null,
      old_status: null,
      new_status: 'pending',
      changed_by: user.id,
    }))
    const HCHUNK = 200
    for (let i = 0; i < historyRows.length; i += HCHUNK) {
      await admin.from('translation_history').insert(historyRows.slice(i, i + HCHUNK))
    }
  }

  return NextResponse.json({
    data: {
      created: newDotKeys.length,
      updated: updatedCount,
      skipped: skippedCount,
      total: entries.length,
      snapshotId,
      filename: file.name,
    },
  })
}
