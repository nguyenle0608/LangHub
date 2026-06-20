import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOrgMembers, inviteMember } from '@/lib/supabase/queries/organizations'
import type { MemberRole } from '@/types'

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'translator', 'viewer']),
})

export async function GET(
  _request: Request,
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

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const members = await getOrgMembers(params.orgId)
  return NextResponse.json({ data: members })
}

export async function POST(
  request: Request,
  { params }: { params: { orgId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only owner/admin can invite
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
  const parsed = InviteMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await inviteMember(params.orgId, parsed.data.email, parsed.data.role as MemberRole)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ data: { success: true } }, { status: 201 })
}
