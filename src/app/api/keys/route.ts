import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTranslationKey } from '@/lib/supabase/queries/translations'

const PostSchema = z.object({
  projectId: z.string().uuid(),
  key: z.string().min(1).max(200).regex(/^[a-z0-9_.]+$/, {
    message: 'Key must be lowercase letters, numbers, dots, and underscores only',
  }),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  charLimit: z.number().int().positive().nullable().optional(),
  localeIds: z.array(z.string().uuid()),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('translation_keys')
    .select('*, translations(*)')
    .eq('project_id', projectId)
    .order('key', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await createTranslationKey({
    ...parsed.data,
    userId: user.id,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json(result, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const keyId = searchParams.get('keyId')
  if (!keyId) return NextResponse.json({ error: 'keyId required' }, { status: 400 })

  const { error } = await supabase.from('translation_keys').delete().eq('id', keyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
