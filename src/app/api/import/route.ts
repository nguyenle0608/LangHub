import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSnapshot } from '@/lib/versions/snapshot'
import { parseJSON } from '@/lib/parsers/json'
import { parseARB } from '@/lib/parsers/arb'
import { parseCSV } from '@/lib/parsers/csv'
import { parseYAML } from '@/lib/parsers/yaml'

// Multipart body: file + metadata fields
// Fields: projectId, localeId, format, filename, snapshotName (optional)

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
    return NextResponse.json({ error: 'Missing required fields: file, projectId, localeId, format' }, { status: 400 })
  }

  if (!SUPPORTED_FORMATS.includes(format as typeof SUPPORTED_FORMATS[number])) {
    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 })
  }

  const content = await file.text()

  // 1. Auto-snapshot before import
  const snapshotResult = await createSnapshot(projectId, user.id, {
    name: snapshotName ?? `Auto: Before import "${file.name}"`,
    tag: 'auto_import',
  })
  const snapshotId = 'error' in snapshotResult ? undefined : snapshotResult.id

  // 2. Parse file
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
    // CSV uses localeId to match column — find the matching locale
    const admin = createAdminClient()
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

  const admin = createAdminClient()

  // 3. Fetch existing keys for this project
  const { data: existingKeys } = await admin
    .from('translation_keys')
    .select('id, key')
    .eq('project_id', projectId)

  const keyMap = new Map<string, string>((existingKeys ?? []).map((k) => [k.key, k.id]))

  let created = 0
  let updated = 0

  // 4. Upsert keys + translations
  for (const [dotKey, value] of Object.entries(parsedKeys)) {
    if (!value.trim()) continue

    let keyId = keyMap.get(dotKey)

    if (!keyId) {
      // Create new key
      const { data: newKey } = await admin
        .from('translation_keys')
        .insert({ project_id: projectId, key: dotKey, created_by: user.id })
        .select('id')
        .single()
      if (!newKey) continue
      keyId = newKey.id
      keyMap.set(dotKey, keyId)

      // Create empty translations for all locales in project
      const { data: allLocales } = await admin.from('locales').select('id').eq('project_id', projectId)
      if (allLocales?.length) {
        await admin.from('translations').insert(
          allLocales.map((l) => ({ key_id: keyId!, locale_id: l.id, value: null, status: 'empty' as const }))
        ).select()
      }
      created++
    } else {
      updated++
    }

    // Upsert translation for this locale
    const { data: upserted } = await admin
      .from('translations')
      .upsert(
        { key_id: keyId, locale_id: localeId, value, status: 'pending', updated_at: new Date().toISOString() },
        { onConflict: 'key_id,locale_id' }
      )
      .select('id')
      .single()

    // History
    if (upserted) {
      await admin.from('translation_history').insert({
        translation_id: upserted.id,
        old_value: null,
        new_value: value,
        old_status: null,
        new_status: 'pending',
        changed_by: user.id,
      })
    }
  }

  return NextResponse.json({
    data: {
      created,
      updated,
      total: created + updated,
      snapshotId,
      filename: file.name,
    },
  })
}
