import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { listBranches, createBranch, deleteBranch, renameBranch, setDefaultBranch, resolveBranchId } from '@/lib/branches/queries'
import { assertBranchAccess, assertProjectAccess } from '@/lib/auth/access'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const access = await assertProjectAccess(user.id, projectId, 'viewer')
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const data = await listBranches(projectId)
  return NextResponse.json({ data })
}

const PostSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  // Branch off this branch; defaults to the project's default (main) branch.
  sourceBranchId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const access = await assertProjectAccess(user.id, parsed.data.projectId, 'translator')
  if (!access.ok) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const sourceBranchId = await resolveBranchId(parsed.data.projectId, parsed.data.sourceBranchId)
  if (!sourceBranchId) return NextResponse.json({ error: 'No source branch found' }, { status: 400 })

  const result = await createBranch({
    projectId: parsed.data.projectId,
    name: parsed.data.name,
    sourceBranchId,
    userId: user.id,
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ data: result }, { status: 201 })
}

const PatchSchema = z.object({
  projectId: z.string().uuid(),
  branchId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  setDefault: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const access = await assertBranchAccess(user.id, parsed.data.branchId, 'admin', parsed.data.projectId)
  if (!access.ok) {
    return NextResponse.json({ error: 'Only owners and admins can manage branches' }, { status: 403 })
  }

  if (parsed.data.name !== undefined) {
    const r = await renameBranch(parsed.data.branchId, parsed.data.name)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
  }
  if (parsed.data.setDefault) {
    const r = await setDefaultBranch(parsed.data.projectId, parsed.data.branchId)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}

const DeleteSchema = z.object({
  projectId: z.string().uuid(),
  branchId: z.string().uuid(),
})

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const access = await assertBranchAccess(user.id, parsed.data.branchId, 'admin', parsed.data.projectId)
  if (!access.ok) {
    return NextResponse.json({ error: 'Only owners and admins can delete branches' }, { status: 403 })
  }

  const result = await deleteBranch(parsed.data.branchId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
