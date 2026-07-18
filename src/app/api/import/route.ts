import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertBranchAccess, assertLocalesAccess, assertProjectAccess } from '@/lib/auth/access'
import { resolveBranchId } from '@/lib/branches/queries'
import { executeImport } from '@/lib/importers/service'
import { IMPORT_FORMATS, ImportValidationError, isImportFile, parseImportContent } from '@/lib/importers/parse'
import type { JsonImportStructure } from '@/lib/localization-namespaces'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const SkipKeysSchema = z.array(z.string().min(1).max(200)).max(5000)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const formData = await req.formData()
  const file = formData.get('file')
  const projectId = formData.get('projectId')
  const localeId = formData.get('localeId')
  const format = formData.get('format')
  const branchParam = formData.get('branchId')
  if (!isImportFile(file) || typeof projectId !== 'string' || typeof localeId !== 'string' || typeof format !== 'string') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!IMPORT_FORMATS.includes(format as typeof IMPORT_FORMATS[number])) {
    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 })
  }

  const projectAccess = await assertProjectAccess(user.id, projectId, 'translator')
  if (!projectAccess.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const branchId = await resolveBranchId(projectId, typeof branchParam === 'string' ? branchParam : null)
  if (!branchId) return NextResponse.json({ error: 'No branch found for project' }, { status: 400 })
  const [branchAccess, localeAccess] = await Promise.all([
    assertBranchAccess(user.id, branchId, 'translator', projectId),
    assertLocalesAccess(user.id, [localeId], 'translator', projectId),
  ])
  if (!branchAccess.ok || !localeAccess.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let localeCode: string | undefined
  if (format === 'csv') {
    const admin = createAdminClient()
    const { data: locale } = await admin.from('locales').select('code').eq('id', localeId).single()
    if (!locale) return NextResponse.json({ error: 'Locale not found' }, { status: 400 })
    localeCode = locale.code
  }
  const skipKeysRaw = formData.get('skipKeys')
  let skipKeys: string[] = []
  if (typeof skipKeysRaw === 'string') {
    let decoded: unknown = null
    try { decoded = JSON.parse(skipKeysRaw) } catch { /* validated below */ }
    const parsed = SkipKeysSchema.safeParse(decoded)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid skipKeys' }, { status: 400 })
    skipKeys = parsed.data
  }

  try {
    const namespace = formData.get('namespace')
    const parsed = parseImportContent({
      content: await file.text(), filename: file.name,
      format: format as typeof IMPORT_FORMATS[number], localeCode,
      namespace: typeof namespace === 'string' ? namespace : null,
      importStructure: (formData.get('importStructure') as JsonImportStructure | null) ?? 'monolithic',
    })
    const result = await executeImport({
      projectId, branchId, localeId, filename: file.name, entries: parsed.entries, skipKeys,
      snapshotName: typeof formData.get('snapshotName') === 'string' ? String(formData.get('snapshotName')) : null,
      skipSnapshot: formData.get('skipAutoSnapshot') === 'true',
      actor: { kind: 'user', userId: user.id, orgId: projectAccess.orgId },
    })
    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof ImportValidationError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 500 })
  }
}
