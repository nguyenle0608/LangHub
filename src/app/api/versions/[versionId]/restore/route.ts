import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { restoreSnapshot } from '@/lib/versions/snapshot'
import { resolveBranchId } from '@/lib/branches/queries'
import { assertBranchAccess, assertProjectAccess, assertVersionAccess } from '@/lib/auth/access'

const RestoreSchema = z.object({
  projectId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  scope: z.enum(['all', 'locale', 'keys']),
  localeCode: z.string().optional(),
  keyNames: z.array(z.string()).optional(),
  createBackupFirst: z.boolean().default(true),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { versionId } = await params
  const body = await req.json() as unknown
  const parsed = RestoreSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [projectAccess, versionAccess] = await Promise.all([
    assertProjectAccess(user.id, parsed.data.projectId, 'admin'),
    assertVersionAccess(user.id, versionId, 'admin', parsed.data.projectId),
  ])
  if (!projectAccess.ok || !versionAccess.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const branchId = await resolveBranchId(parsed.data.projectId, parsed.data.branchId)
  if (!branchId) return NextResponse.json({ error: 'No branch found for project' }, { status: 400 })
  const branchAccess = await assertBranchAccess(user.id, branchId, 'admin', parsed.data.projectId)
  if (!branchAccess.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await restoreSnapshot(versionId, parsed.data.projectId, user.id, branchId, {
    scope: parsed.data.scope,
    localeCode: parsed.data.localeCode,
    keyNames: parsed.data.keyNames,
    createBackupFirst: parsed.data.createBackupFirst,
  })

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ data: result })
}
