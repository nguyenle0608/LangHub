import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { updateMemberRole, removeMember } from '@/lib/supabase/queries/organizations'
import type { MemberRole } from '@/types'

const UpdateRoleSchema = z.object({
  role: z.enum(['admin', 'translator', 'viewer']),
})

export async function PATCH(
  request: Request,
  { params }: { params: { orgId: string; memberId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only owner/admin can change roles
  const { data: requesterMember } = await supabase
    .from('members')
    .select('role')
    .eq('org_id', params.orgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!requesterMember || !['owner', 'admin'].includes(requesterMember.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body: unknown = await request.json()
  const parsed = UpdateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await updateMemberRole(params.memberId, parsed.data.role as MemberRole)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { orgId: string; memberId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only owner/admin can remove members
  const { data: requesterMember } = await supabase
    .from('members')
    .select('role')
    .eq('org_id', params.orgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!requesterMember || !['owner', 'admin'].includes(requesterMember.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await removeMember(params.memberId)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } })
}
