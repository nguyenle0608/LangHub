import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getUserOrgRole } from '@/lib/supabase/queries/organizations'
import { listBranches, createBranch, deleteBranch, resolveBranchId } from '@/lib/branches/queries'

async function roleForProject(projectId: string, userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('org_id').eq('id', projectId).single()
  if (!project?.org_id) return null
  return getUserOrgRole(project.org_id, userId)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

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

  const role = await roleForProject(parsed.data.projectId, user.id)
  if (!role || role === 'viewer') {
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

  const role = await roleForProject(parsed.data.projectId, user.id)
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only owners and admins can delete branches' }, { status: 403 })
  }

  const result = await deleteBranch(parsed.data.branchId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
