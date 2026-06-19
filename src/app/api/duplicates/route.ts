import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { findDuplicateGroups, mergeKeys, linkKeys } from '@/lib/supabase/queries/keys'

const MergeSchema = z.object({
  projectId: z.string().uuid(),
  parentKeyId: z.string().uuid(),
  childKeyIds: z.array(z.string().uuid()).min(1),
})

const LinkSchema = z.object({
  parentKeyId: z.string().uuid(),
  childKeyId: z.string().uuid(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const groups = await findDuplicateGroups(projectId)
  return NextResponse.json({ data: groups })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') // 'merge' | 'link'

  const body = await req.json() as unknown

  if (action === 'link') {
    const parsed = LinkSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const result = await linkKeys(parsed.data.parentKeyId, parsed.data.childKeyId)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // default: merge
  const parsed = MergeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const result = await mergeKeys(
    parsed.data.parentKeyId,
    parsed.data.childKeyIds,
    parsed.data.projectId,
    user.id
  )
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}
