import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { removeLocale, setBaseLocale, updateLocaleCode } from '@/lib/supabase/queries/projects'
import { assertLocalesAccess, assertProjectAccess } from '@/lib/auth/access'
import { isValidLocaleCode, normalizeLocaleCode } from '@/lib/locale-code'

// Same canonical form as adding a language: en_us, EN-US and en-US are one code.
const UpdateLocaleSchema = z.object({
  code: z.string()
    .transform((value) => normalizeLocaleCode(value) ?? value)
    .refine(isValidLocaleCode, {
      message: 'Locale code must be a language like "ms", optionally with a region like "en-US"',
    }),
  // Optional: the caller picked from the language list and knows the name that
  // belongs to the new code.
  name: z.string().min(1).max(100).optional(),
}).refine((body) => !body.name || normalizeLocaleCode(body.name) !== body.code, {
  // Same rule as creating one: a name that repeats the code is a failed lookup.
  message: 'Language name is missing — it cannot just repeat the code',
  path: ['name'],
})

export async function PATCH(
  request: Request,
  { params }: { params: { projectId: string; localeId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [projectAccess, localeAccess] = await Promise.all([
    assertProjectAccess(user.id, params.projectId, 'admin'),
    assertLocalesAccess(user.id, [params.localeId], 'admin', params.projectId),
  ])
  if (!projectAccess.ok || !localeAccess.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // A body means "change this language's code"; no body keeps the original
  // meaning of PATCH here, which is "make this the base language".
  const body: unknown = await request.json().catch(() => null)
  if (body && typeof body === 'object') {
    const parsed = UpdateLocaleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid locale code' }, { status: 400 })
    }
    const updated = await updateLocaleCode(params.projectId, params.localeId, parsed.data.code, parsed.data.name)
    // A code already in use is the caller's mistake, not a server fault.
    if (updated.error) return NextResponse.json({ error: updated.error }, { status: 409 })
    return NextResponse.json({ success: true, locale: updated.locale })
  }

  const result = await setBaseLocale(params.projectId, params.localeId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { projectId: string; localeId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [projectAccess, localeAccess] = await Promise.all([
    assertProjectAccess(user.id, params.projectId, 'admin'),
    assertLocalesAccess(user.id, [params.localeId], 'admin', params.projectId),
  ])
  if (!projectAccess.ok || !localeAccess.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: locale } = await supabase
    .from('locales')
    .select('is_base')
    .eq('id', params.localeId)
    .eq('project_id', params.projectId)
    .single()

  if (locale?.is_base) {
    return NextResponse.json({ error: 'Cannot delete base locale' }, { status: 400 })
  }

  const result = await removeLocale(params.localeId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true })
}
