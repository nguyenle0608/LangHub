import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSnapshot } from '@/lib/versions/snapshot'
import { parseJSON } from '@/lib/parsers/json'
import { parseARB } from '@/lib/parsers/arb'
import { parseCSV } from '@/lib/parsers/csv'
import { parseYAML } from '@/lib/parsers/yaml'

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

  if (!file || !projectId || !localeId || !format) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!SUPPORTED_FORMATS.includes(format as typeof SUPPORTED_FORMATS[number])) {
    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 })
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

  // Filter empty values
  const entries = Object.entries(parsedKeys).filter(([, v]) => v.trim())
  if (entries.length === 0) {
    return NextResponse.json({ error: 'No valid keys found in file' }, { status: 400 })
  }

  // 2. Auto-snapshot before import
  const snapshotResult = await createSnapshot(projectId, user.id, {
    name: snapshotName ?? `Auto: Before import "${file.name}"`,
    tag: 'auto_import',
  })
  const snapshotId = 'error' in snapshotResult ? undefined : snapshotResult.id

  // 3. Fetch existing keys + all locales in parallel
  const [{ data: existingKeys }, { data: allLocales }] = await Promise.all([
    admin.from('translation_keys').select('id, key').eq('project_id', projectId),
    admin.from('locales').select('id').eq('project_id', projectId),
  ])

  const keyMap = new Map<string, string>((existingKeys ?? []).map((k) => [k.key, k.id]))
  const localeIds = (allLocales ?? []).map((l) => l.id)

  // 4. Separate new vs existing keys
  const newDotKeys = entries.filter(([k]) => !keyMap.has(k)).map(([k]) => k)
  const updatedCount = entries.filter(([k]) => keyMap.has(k)).length

  // 5. Batch insert new translation_keys
  if (newDotKeys.length > 0) {
    const CHUNK = 200
    for (let i = 0; i < newDotKeys.length; i += CHUNK) {
      const chunk = newDotKeys.slice(i, i + CHUNK)
      const { data: inserted } = await admin
        .from('translation_keys')
        .insert(chunk.map((key) => ({ project_id: projectId, key, created_by: user.id })))
        .select('id, key')
      for (const row of inserted ?? []) keyMap.set(row.key, row.id)
    }

    // 6. Batch insert empty translations for all locales × new keys
    const emptyRows = newDotKeys.flatMap((k) => {
      const keyId = keyMap.get(k)
      if (!keyId) return []
      return localeIds.map((lid) => ({ key_id: keyId, locale_id: lid, value: null, status: 'empty' as const }))
    })
    const TCHUNK = 500
    for (let i = 0; i < emptyRows.length; i += TCHUNK) {
      await admin.from('translations').insert(emptyRows.slice(i, i + TCHUNK))
    }
  }

  // 7. Batch upsert translations for the imported locale
  const upsertRows = entries.map(([dotKey, value]) => ({
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
      .upsert(upsertRows.slice(i, i + UCHUNK), { onConflict: 'key_id,locale_id' })
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
      total: entries.length,
      snapshotId,
      filename: file.name,
    },
  })
}
