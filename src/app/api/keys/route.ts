import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createTranslationKey, getTranslationKeys, getTranslationKeysPage } from '@/lib/supabase/queries/translations'
import { resolveBranchId } from '@/lib/branches/queries'
import { assertBranchAccess, assertKeysAccess, assertLocalesAccess, assertProjectAccess } from '@/lib/auth/access'

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

  // When the editor already passes an active branch id, avoid an extra branch
  // lookup on every streaming page. The data query remains scoped by both
  // project_id and branch_id, with RLS still applied.
  const branchParam = searchParams.get('branch')
  const branchId = branchParam ?? await resolveBranchId(projectId, null)
  if (!branchId) return NextResponse.json({ error: 'No branch found for project' }, { status: 400 })

  // Windowed mode (?limit=&after=): keyset/cursor pagination. `after` is the
  // last key of the previous page (omit for the first page). Returns one page
  // plus the branch total (first page only). Without limit, return everything.
  const limitParam = searchParams.get('limit')
  if (limitParam !== null) {
    const limit = Math.max(1, Math.min(2000, Number(limitParam) || 0))
    const after = searchParams.get('after') ?? undefined
    const { keys, total } = await getTranslationKeysPage(projectId, branchId, {
      afterKey: after,
      limit,
      includeCount: after === undefined,
    })
    return NextResponse.json({ data: keys, total })
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

  const projectAccess = await assertProjectAccess(user.id, parsed.data.projectId, 'translator')
  if (!projectAccess.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const branchId = await resolveBranchId(parsed.data.projectId, parsed.data.branchId)
  if (!branchId) return NextResponse.json({ error: 'No branch found for project' }, { status: 400 })
  const [branchAccess, localeAccess] = await Promise.all([
    assertBranchAccess(user.id, branchId, 'translator', parsed.data.projectId),
    parsed.data.localeIds.length > 0
      ? assertLocalesAccess(user.id, parsed.data.localeIds, 'translator', parsed.data.projectId)
      : Promise.resolve({ ok: true } as const),
  ])
  if (!branchAccess.ok || !localeAccess.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
  ids: z.array(z.string().uuid()).min(1),
})

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'ids[] required' }, { status: 400 })

  const access = await assertKeysAccess(user.id, parsed.data.ids, 'admin')
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  // Chunk the delete: a single .in('id', [...]) with many UUIDs overflows the
  // PostgREST request URL (same failure mode as large .in() reads).
  const ids = parsed.data.ids
  const CHUNK = 100
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await admin
      .from('translation_keys')
      .delete()
      .in('id', ids.slice(i, i + CHUNK))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, deleted: ids.length })
}
