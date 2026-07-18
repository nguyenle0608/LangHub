import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertOrgAccess } from '@/lib/auth/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { normalizeAssistanceText } from '@/lib/translation-assistance/matcher'

const CreateSchema = z.object({
  sourceLocale: z.string().trim().toLowerCase().regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/),
  targetLocale: z.string().trim().toLowerCase().regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/),
  sourceTerm: z.string().trim().min(1).max(500),
  targetTerm: z.string().trim().min(1).max(500),
  caseSensitive: z.boolean().default(false),
  wholeWord: z.boolean().default(true),
  description: z.string().trim().max(2000).nullable().default(null),
}).refine((value) => value.sourceLocale.toLowerCase() !== value.targetLocale.toLowerCase(), {
  message: 'Source and target locales must differ', path: ['targetLocale'],
})

const ListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

async function userAndRole(orgId: string, minRole: 'viewer' | 'admin') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const access = await assertOrgAccess(user.id, orgId, minRole)
  return access.ok ? { user, access } : null
}

export async function GET(request: Request, { params }: { params: { orgId: string } }) {
  const auth = await userAndRole(params.orgId, 'viewer')
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const url = new URL(request.url)
  const sourceLocale = url.searchParams.get('sourceLocale')?.trim().toLowerCase()
  const targetLocale = url.searchParams.get('targetLocale')?.trim().toLowerCase()
  const page = ListSchema.safeParse({ limit: url.searchParams.get('limit') ?? undefined, offset: url.searchParams.get('offset') ?? undefined })
  if (!page.success) return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 })
  const admin = createAdminClient()
  let query = admin.from('glossary_terms').select('*', { count: 'exact' }).eq('org_id', params.orgId)
    .order('source_locale').order('target_locale').order('source_normalized')
  if (sourceLocale) query = query.eq('source_locale', sourceLocale)
  if (targetLocale) query = query.eq('target_locale', targetLocale)
  const { data, error, count } = await query.range(page.data.offset, page.data.offset + page.data.limit - 1)
  if (error) return NextResponse.json({ error: 'Failed to list glossary terms' }, { status: 500 })
  const nextOffset = page.data.offset + (data?.length ?? 0)
  return NextResponse.json({
    data: data ?? [],
    pagination: { nextOffset: count != null && nextOffset < count ? nextOffset : null, total: count ?? null },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request, { params }: { params: { orgId: string } }) {
  const auth = await userAndRole(params.orgId, 'admin')
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const value = parsed.data
  const { data, error } = await createAdminClient().from('glossary_terms').insert({
    org_id: params.orgId,
    source_locale: value.sourceLocale.toLowerCase(),
    target_locale: value.targetLocale.toLowerCase(),
    source_term: value.sourceTerm,
    source_normalized: normalizeAssistanceText(value.sourceTerm),
    target_term: value.targetTerm,
    case_sensitive: value.caseSensitive,
    whole_word: value.wholeWord,
    description: value.description || null,
    created_by: auth.user.id,
  }).select('*').single()
  if (error) {
    return NextResponse.json(
      { error: error.code === '23505' ? 'A glossary term already exists for this locale pair' : 'Failed to create glossary term' },
      { status: error.code === '23505' ? 409 : 500 },
    )
  }
  return NextResponse.json({ data }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
