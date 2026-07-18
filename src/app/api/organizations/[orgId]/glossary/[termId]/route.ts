import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertOrgAccess } from '@/lib/auth/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { normalizeAssistanceText } from '@/lib/translation-assistance/matcher'

const UpdateSchema = z.object({
  sourceLocale: z.string().trim().toLowerCase().regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/),
  targetLocale: z.string().trim().toLowerCase().regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/),
  sourceTerm: z.string().trim().min(1).max(500),
  targetTerm: z.string().trim().min(1).max(500),
  caseSensitive: z.boolean(),
  wholeWord: z.boolean(),
  description: z.string().trim().max(2000).nullable(),
}).refine((value) => value.sourceLocale.toLowerCase() !== value.targetLocale.toLowerCase(), {
  message: 'Source and target locales must differ', path: ['targetLocale'],
})

async function authorize(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  return (await assertOrgAccess(user.id, orgId, 'admin')).ok
}

export async function PATCH(request: Request, { params }: { params: { orgId: string; termId: string } }) {
  if (!(await authorize(params.orgId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const value = parsed.data
  const { data, error } = await createAdminClient().from('glossary_terms').update({
    source_locale: value.sourceLocale.toLowerCase(), target_locale: value.targetLocale.toLowerCase(),
    source_term: value.sourceTerm, target_term: value.targetTerm,
    source_normalized: normalizeAssistanceText(value.sourceTerm),
    case_sensitive: value.caseSensitive, whole_word: value.wholeWord,
    description: value.description || null,
  }).eq('id', params.termId).eq('org_id', params.orgId).select('*').maybeSingle()
  if (error?.code === '23505') return NextResponse.json({ error: 'A glossary term already exists for this locale pair' }, { status: 409 })
  if (error) return NextResponse.json({ error: 'Failed to update glossary term' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(_request: Request, { params }: { params: { orgId: string; termId: string } }) {
  if (!(await authorize(params.orgId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await createAdminClient().from('glossary_terms').delete()
    .eq('id', params.termId).eq('org_id', params.orgId).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'Failed to delete glossary term' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: { deleted: true } })
}
