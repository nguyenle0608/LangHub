import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createTranslationKey, getTranslationKeys, getTranslationKeyCount } from '@/lib/supabase/queries/translations'
import { resolveBranchId } from '@/lib/branches/queries'

const PostSchema = z.object({
  projectId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
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

  const branchId = await resolveBranchId(projectId, searchParams.get('branch'))
  if (!branchId) return NextResponse.json({ error: 'No branch found for project' }, { status: 400 })

  // Windowed mode (?limit=&after=): keyset/cursor pagination. `after` is the
  // last key of the previous page (omit for the first page). Returns one page
  // plus the branch total (first page only). Without limit, return everything.
  const limitParam = searchParams.get('limit')
  if (limitParam !== null) {
    const limit = Math.max(1, Math.min(2000, Number(limitParam) || 0))
    const after = searchParams.get('after') ?? undefined
    const [data, total] = await Promise.all([
      getTranslationKeys(projectId, branchId, { afterKey: after, limit }),
      after === undefined ? getTranslationKeyCount(projectId, branchId) : Promise.resolve(undefined),
    ])
    return NextResponse.json({ data, total })
  }

  const data = await getTranslationKeys(projectId, branchId)
  return NextResponse.json({ data })
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

  const branchId = await resolveBranchId(parsed.data.projectId, parsed.data.branchId)
  if (!branchId) return NextResponse.json({ error: 'No branch found for project' }, { status: 400 })

  const result = await createTranslationKey({
    ...parsed.data,
    branchId,
    userId: user.id,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result, { status: 201 })
}

const DeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
})

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'ids[] required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('translation_keys')
    .delete()
    .in('id', parsed.data.ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, deleted: parsed.data.ids.length })
}
