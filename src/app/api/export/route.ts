import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exportJSON } from '@/lib/exporters/json'
import { exportARB } from '@/lib/exporters/arb'
import { exportCSV } from '@/lib/exporters/csv'
import { exportYAML } from '@/lib/exporters/yaml'
import { exportZIP } from '@/lib/exporters/zip'
import { buildExportLookup, ExportDataQueryError, fetchExportData } from '@/lib/exporters/data'
import { resolveBranchId } from '@/lib/branches/queries'

// POST body: { projectId, branchId?, localeIds[], format, filter, nested? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    projectId: string
    branchId?: string
    localeIds: string[]
    format: 'json' | 'arb' | 'csv' | 'yaml'
    filter: 'all' | 'approved' | 'reviewed_approved'
    nested?: boolean
  }

  const { projectId, localeIds, format, filter, nested = true } = body
  if (!projectId || !localeIds?.length || !format) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const branchId = await resolveBranchId(projectId, body.branchId)
  if (!branchId) return NextResponse.json({ error: 'No branch found for project' }, { status: 400 })

  const admin = createAdminClient()

  let keys
  let translations
  try {
    const exportData = await fetchExportData(admin, branchId, localeIds)
    keys = exportData.keys
    translations = exportData.translations
  } catch (error) {
    const message = error instanceof ExportDataQueryError ? error.message : 'Failed to load export data'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  if (!keys?.length) {
    return NextResponse.json({ error: 'No keys found' }, { status: 400 })
  }

  // Fetch locales
  const { data: locales, error: localesError } = await admin
    .from('locales')
    .select('id, code, name')
    .in('id', localeIds)

  if (localesError) {
    return NextResponse.json(
      { error: `Failed to load locales for export: ${localesError.message}` },
      { status: 500 }
    )
  }

  if (!locales?.length) {
    return NextResponse.json({ error: 'No locales found' }, { status: 400 })
  }

  // Build lookup: localeId → keyName → value
  const byLocale = buildExportLookup(keys, translations, filter)

  const descriptions = Object.fromEntries(
    keys.filter((k) => k.description).map((k) => [k.key, k.description as string])
  )

  // CSV is multi-locale in one file
  if (format === 'csv') {
    const keyNames = keys.map((k) => k.key)
    const localeCodes = locales.map((l) => l.code)
    const translationsMap: Record<string, Record<string, string>> = {}
    for (const k of keyNames) {
      translationsMap[k] = {}
      for (const locale of locales) {
        translationsMap[k]![locale.code] = byLocale.get(locale.id)?.[k] ?? ''
      }
    }
    const csv = exportCSV(keyNames, localeCodes, translationsMap)
    const slug = locales.map((l) => l.code).join('-')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="translations-${slug}.csv"`,
      },
    })
  }

  // Single locale — return file directly
  if (localeIds.length === 1) {
    const locale = locales[0]!
    const localeKeys = byLocale.get(locale.id) ?? {}

    let content: string
    let contentType = 'application/json'
    let ext = format

    if (format === 'json') {
      content = exportJSON(localeKeys, nested)
    } else if (format === 'arb') {
      content = exportARB(localeKeys, locale.code, descriptions)
      ext = 'arb'
    } else {
      content = exportYAML(localeKeys)
      contentType = 'text/yaml'
      ext = 'yaml'
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${locale.code}.${ext}"`,
      },
    })
  }

  // Multiple locales — ZIP
  const files: { name: string; content: string }[] = []
  for (const locale of locales) {
    const localeKeys = byLocale.get(locale.id) ?? {}
    let content: string
    let ext: string

    if (format === 'json') {
      content = exportJSON(localeKeys, nested)
      ext = 'json'
    } else if (format === 'arb') {
      content = exportARB(localeKeys, locale.code, descriptions)
      ext = 'arb'
    } else {
      content = exportYAML(localeKeys)
      ext = 'yaml'
    }
    files.push({ name: `${locale.code}.${ext}`, content })
  }

  const zipBuffer = await exportZIP(files)

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="translations.zip"`,
    },
  })
}
