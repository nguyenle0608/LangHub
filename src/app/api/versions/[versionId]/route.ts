import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getVersion, deleteVersion } from '@/lib/versions/snapshot'
import { diffVersions } from '@/lib/versions/diff'
import { resolveBranchId } from '@/lib/branches/queries'
import { assertBranchAccess, assertVersionAccess } from '@/lib/auth/access'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { versionId } = await params
  const { searchParams } = new URL(req.url)
  const compareWith = searchParams.get('compareWith') // versionId or 'current'
  const projectId = searchParams.get('projectId')

  const access = await assertVersionAccess(user.id, versionId, 'viewer', projectId ?? undefined)
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const version = await getVersion(versionId)
  if (!version) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If diff requested
  if (compareWith && projectId) {
    if (compareWith !== 'current') {
      const compareAccess = await assertVersionAccess(user.id, compareWith, 'viewer', projectId)
      if (!compareAccess.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Default to the snapshot's own branch, then the project's main branch
    const branchId = await resolveBranchId(projectId, searchParams.get('branchId') ?? version.branch_id)
    if (branchId) {
      const branchAccess = await assertBranchAccess(user.id, branchId, 'viewer', projectId)
      if (!branchAccess.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const diff = await diffVersions(projectId, versionId, compareWith, branchId ?? undefined)
    return NextResponse.json({ data: { version, diff } })
  }

  return NextResponse.json({ data: version })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { versionId } = await params
  const access = await assertVersionAccess(user.id, versionId, 'admin')
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await deleteVersion(versionId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
