import { NextResponse } from 'next/server'
import { assertOrgAccess } from '@/lib/auth/access'
import { revokeOrganizationApiToken } from '@/lib/api-tokens/management'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: Request,
  { params }: { params: { orgId: string; tokenId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await assertOrgAccess(user.id, params.orgId, 'admin')
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const revoked = await revokeOrganizationApiToken(params.orgId, params.tokenId)
  if (!revoked) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: { revoked: true } }, { headers: { 'Cache-Control': 'no-store' } })
}

