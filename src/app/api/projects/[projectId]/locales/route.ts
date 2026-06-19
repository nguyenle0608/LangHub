import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { addLocale } from '@/lib/supabase/queries/projects'

const AddLocaleSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(1).max(100),
})

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await request.json()
  const parsed = AddLocaleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await addLocale(params.projectId, parsed.data.code, parsed.data.name)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true }, { status: 201 })
}
