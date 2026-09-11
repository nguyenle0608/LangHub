import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertOrgAccess } from '@/lib/auth/access'
import {
  MAX_ACTIVE_API_TOKENS,
  MAX_ROTATION_GRACE_MINUTES,
  rotateOrganizationApiToken,
} from '@/lib/api-tokens/management'
import { createClient } from '@/lib/supabase/server'
import { zodErrorResponse } from '@/lib/api/validation-error'

const RotateSchema = z.object({
  // Zero by default: rotation is most often a response to a leak, and the safe
  // default for a credential you no longer trust is that it stops working now.
  // An overlap is opted into, with a number someone had to think about.
  graceMinutes: z.number().int().min(0).max(MAX_ROTATION_GRACE_MINUTES).default(0),
})

const MESSAGES = {
  limit: `An organization may have at most ${MAX_ACTIVE_API_TOKENS} active API tokens`,
  not_found: 'Token not found',
  not_active: 'This token is already revoked or expired — create a new one instead',
  database: 'Failed to rotate API token',
} as const

const STATUS = { limit: 409, not_found: 404, not_active: 409, database: 500 } as const

export async function POST(
  request: Request,
  { params }: { params: { orgId: string; tokenId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await assertOrgAccess(user.id, params.orgId, 'admin')
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = RotateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return zodErrorResponse(parsed.error)

  const result = await rotateOrganizationApiToken({
    orgId: params.orgId,
    userId: user.id,
    tokenId: params.tokenId,
    graceMinutes: parsed.data.graceMinutes,
  })
  if ('error' in result) {
    return NextResponse.json({ error: MESSAGES[result.error] }, { status: STATUS[result.error] })
  }
  // The secret is in this body and nowhere else, now or later — same contract
  // as creation, and the same reason for no-store.
  return NextResponse.json(
    { data: result },
    { status: 201, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
  )
}
