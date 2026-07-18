import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { computeMerge, applyMerge } from '@/lib/branches/merge'
import { deleteBranch } from '@/lib/branches/queries'
import { assertBranchAccess, assertProjectAccess } from '@/lib/auth/access'

const CellSchema = z.object({
  keyName: z.string(),
  localeCode: z.string(),
  value: z.string().nullable(),
  status: z.string().nullable(),
})

const Schema = z.object({
  projectId: z.string().uuid(),
  sourceBranchId: z.string().uuid(),
  targetBranchId: z.string().uuid(),
  apply: z.boolean().default(false),
  deleteSource: z.boolean().default(false),
  resolutions: z.array(CellSchema).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { projectId, sourceBranchId, targetBranchId, apply, deleteSource, resolutions } = parsed.data
  if (sourceBranchId === targetBranchId) {
    return NextResponse.json({ error: 'Source and target branches must differ' }, { status: 400 })
  }

  const [projectAccess, sourceAccess, targetAccess] = await Promise.all([
    assertProjectAccess(user.id, projectId, 'admin'),
    assertBranchAccess(user.id, sourceBranchId, 'admin', projectId),
    assertBranchAccess(user.id, targetBranchId, 'admin', projectId),
  ])
  if (!projectAccess.ok || !sourceAccess.ok || !targetAccess.ok) {
    return NextResponse.json({ error: 'Only owners and admins can merge branches' }, { status: 403 })
  }

  const plan = await computeMerge(projectId, sourceBranchId, targetBranchId)
  if ('error' in plan) return NextResponse.json({ error: plan.error }, { status: 400 })

  // Preview mode — return the full plan for the review UI
  if (!apply) {
    return NextResponse.json({
      data: { auto: plan.auto, conflicts: plan.conflicts },
    })
  }

  // Apply mode — must resolve every conflict
  if (plan.conflicts.length > 0) {
    const provided = new Set((resolutions ?? []).map((r) => `${r.keyName}::${r.localeCode}`))
    const unresolved = plan.conflicts.filter((c) => !provided.has(`${c.keyName}::${c.localeCode}`))
    if (unresolved.length > 0) {
      return NextResponse.json(
        { error: `${unresolved.length} conflict(s) not resolved`, conflicts: plan.conflicts },
        { status: 409 }
      )
    }
  }

  const result = await applyMerge({
    projectId,
    sourceBranchId,
    targetBranchId,
    userId: user.id,
    auto: plan.auto,
    resolutions: resolutions ?? [],
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })

  // Optionally delete the source branch after a successful merge
  let deletedSource = false
  if (deleteSource) {
    const del = await deleteBranch(sourceBranchId)
    deletedSource = !('error' in del)
  }

  return NextResponse.json({ data: { ...result, deletedSource } })
}
