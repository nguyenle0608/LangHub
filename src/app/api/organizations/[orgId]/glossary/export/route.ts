import { NextResponse } from 'next/server'
import { assertOrgAccess } from '@/lib/auth/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { loadAllPages } from '@/lib/exporters/data'
import { exportGlossaryCSV, type GlossaryExportRow } from '@/lib/glossary/csv'

interface GlossaryTermRow {
  source_locale: string
  target_locale: string
  source_term: string
  target_term: string
  case_sensitive: boolean
  whole_word: boolean
  description: string | null
}

// Same read access as the list endpoint — exporting is just a bulk read.
export async function GET(request: Request, { params }: { params: { orgId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const access = await assertOrgAccess(user.id, params.orgId, 'viewer')
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const sourceLocale = url.searchParams.get('sourceLocale')?.trim().toLowerCase()
  const targetLocale = url.searchParams.get('targetLocale')?.trim().toLowerCase()

  const admin = createAdminClient()
  const rows = await loadAllPages<GlossaryTermRow>('glossary terms', (from, to) => {
    let query = admin
      .from('glossary_terms')
      .select('source_locale, target_locale, source_term, target_term, case_sensitive, whole_word, description')
      .eq('org_id', params.orgId)
    if (sourceLocale) query = query.eq('source_locale', sourceLocale)
    if (targetLocale) query = query.eq('target_locale', targetLocale)
    return query.order('source_locale').order('target_locale').order('source_normalized').range(from, to)
  }).catch(() => null)

  if (rows === null) return NextResponse.json({ error: 'Failed to export glossary terms' }, { status: 500 })

  const exportRows: GlossaryExportRow[] = rows.map((row) => ({
    sourceLocale: row.source_locale,
    targetLocale: row.target_locale,
    sourceTerm: row.source_term,
    targetTerm: row.target_term,
    caseSensitive: row.case_sensitive,
    wholeWord: row.whole_word,
    description: row.description,
  }))

  return new NextResponse(exportGlossaryCSV(exportRows), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="glossary.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
