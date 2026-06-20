import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  updateOrganization,
  deleteOrganization,
} from '@/lib/supabase/queries/organizations'

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: { orgId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', params.orgId)
    .single()

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: org })
}

export async function PATCH(
  request: Request,
  { params }: { params: { orgId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify membership
  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('org_id', params.orgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['owner', 'admin'].includes(member.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body: unknown = await request.json()
  const parsed = UpdateOrgSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await updateOrganization(params.orgId, parsed.data)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { orgId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only owners can delete
  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('org_id', params.orgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: only the owner can delete a workspace' }, { status: 403 })
  }

  const result = await deleteOrganization(params.orgId)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } })
}
