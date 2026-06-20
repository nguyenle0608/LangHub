import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addLocale } from '@/lib/supabase/queries/projects'

const AddLocaleSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(1).max(100),
})

const BulkAddLocalesSchema = z.object({
  locales: z.array(z.object({
    code: z.string().min(2).max(10),
    name: z.string().min(1).max(100),
  })).min(1).max(100),
})

// Single locale
export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await request.json()

  // Bulk: { locales: [{code, name}] }
  const bulk = BulkAddLocalesSchema.safeParse(body)
  if (bulk.success) {
    const admin = createAdminClient()
    const { error } = await admin.from('locales').insert(
      bulk.data.locales.map((l) => ({ project_id: params.projectId, code: l.code, name: l.name, is_base: false }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true }, { status: 201 })
  }

  // Single: { code, name }
  const parsed = AddLocaleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await addLocale(params.projectId, parsed.data.code, parsed.data.name)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true, locale: result.locale }, { status: 201 })
}
