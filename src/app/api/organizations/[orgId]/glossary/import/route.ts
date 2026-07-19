import { NextResponse } from 'next/server'
import { assertOrgAccess } from '@/lib/auth/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { normalizeAssistanceText } from '@/lib/translation-assistance/matcher'
import { parseGlossaryCSV } from '@/lib/glossary/csv'

// Bulk term creation is as sensitive as the rest of glossary curation
// (workspace settings, already admin/owner-gated at the page level), so this
// mirrors the same floor as PATCH/DELETE rather than the translator+ floor
// used for the single in-context "Quick Add" endpoint.
const MIN_ROLE = 'admin'
const MAX_ROWS = 5000
const CHUNK_SIZE = 500

export async function POST(request: Request, { params }: { params: { orgId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const access = await assertOrgAccess(user.id, params.orgId, MIN_ROLE)
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'A CSV file is required' }, { status: 400 })
  }

  const content = await file.text()
  const parsed = parseGlossaryCSV(content)

  if (parsed.rows.length === 0 && parsed.errors.length === 1 && parsed.errors[0]!.startsWith('Missing required column')) {
    return NextResponse.json({ error: parsed.errors[0] }, { status: 400 })
  }
  if (parsed.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows — limit is ${MAX_ROWS} per file` }, { status: 400 })
  }

  const admin = createAdminClient()
  let created = 0

  for (let i = 0; i < parsed.rows.length; i += CHUNK_SIZE) {
    const chunk = parsed.rows.slice(i, i + CHUNK_SIZE).map((row) => ({
      org_id: params.orgId,
      source_locale: row.sourceLocale,
      target_locale: row.targetLocale,
      source_term: row.sourceTerm,
      source_normalized: normalizeAssistanceText(row.sourceTerm),
      target_term: row.targetTerm,
      case_sensitive: row.caseSensitive,
      whole_word: row.wholeWord,
      created_by: user.id,
    }))
    // ON CONFLICT DO NOTHING: pre-existing terms and duplicate rows within the
    // same file are both silently skipped (Postgres resolves intra-batch
    // conflicts against the unique index row-by-row); only genuinely new terms
    // come back, so `created` stays an exact count.
    const { data, error } = await admin
      .from('glossary_terms')
      .upsert(chunk, { onConflict: 'org_id,source_locale,target_locale,source_normalized', ignoreDuplicates: true })
      .select('id')
    if (error) return NextResponse.json({ error: 'Failed to import glossary terms' }, { status: 500 })
    created += data?.length ?? 0
  }

  const skipped = parsed.rows.length - created
  return NextResponse.json({
    data: { totalRows: parsed.rows.length, created, skipped, errors: parsed.errors },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
