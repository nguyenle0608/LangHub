import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getVersion, deleteVersion } from '@/lib/versions/snapshot'
import { diffVersions } from '@/lib/versions/diff'

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
  const branchId = searchParams.get('branchId') ?? undefined

  const version = await getVersion(versionId)
  if (!version) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If diff requested
  if (compareWith && projectId) {
    const diff = await diffVersions(projectId, versionId, compareWith, branchId)
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
  const result = await deleteVersion(versionId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
