import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addLocale } from '@/lib/supabase/queries/projects'
import { assertProjectAccess } from '@/lib/auth/access'
import { isValidLocaleCode, normalizeLocaleCode } from '@/lib/locale-code'
import { zodErrorResponse } from '@/lib/api/validation-error'

// Codes are stored canonically — lowercase language, uppercase region — so
// en-US, en_us and EN-US cannot become three different locales on one project.
// The region is significant: en-US and en-CA hold different translations.
const LocaleCodeSchema = z.string()
  .transform((value) => normalizeLocaleCode(value) ?? value)
  .refine(isValidLocaleCode, {
    message: 'Locale code must be a language like "ms", optionally with a region like "en-US"',
  })

// No language is named after its own code. A name equal to the code means the
// caller could not look one up and sent the code instead — that name is then
// stored and shown as the language's name for good, which is how a project
// ended up listing "ar-AE" and "vi-VN" where names belong.
const NAME_IS_A_CODE = 'Language name is missing — it cannot just repeat the code'

const LocaleEntrySchema = z.object({
  code: LocaleCodeSchema,
  name: z.string().min(1).max(100),
  // Compared after normalising the name, not as raw text: "AR_ae" is the same
  // code as "ar-AE" and just as useless as a name.
}).refine((locale) => normalizeLocaleCode(locale.name) !== locale.code, {
  message: NAME_IS_A_CODE,
  path: ['name'],
})

const AddLocaleSchema = LocaleEntrySchema

const BulkAddLocalesSchema = z.object({
  locales: z.array(LocaleEntrySchema).min(1).max(100),
})

// Single locale
export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await assertProjectAccess(user.id, params.projectId, 'admin')
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: unknown = await request.json()

  // Bulk: { locales: [{code, name}] }
  const bulk = BulkAddLocalesSchema.safeParse(body)
  if (bulk.success) {
    const admin = createAdminClient()
    // Return the inserted rows: the caller needs their ids to show the new
    // languages without waiting for a full refetch.
    const { data, error } = await admin.from('locales').insert(
      bulk.data.locales.map((l) => ({ project_id: params.projectId, code: l.code, name: l.name, is_base: false }))
    ).select('id, code, name, is_base')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, locales: data ?? [] }, { status: 201 })
  }

  // Single: { code, name }
  const parsed = AddLocaleSchema.safeParse(body)
  if (!parsed.success) return zodErrorResponse(parsed.error)

  const result = await addLocale(params.projectId, parsed.data.code, parsed.data.name)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true, locale: result.locale }, { status: 201 })
}
