import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertOrgAccess } from '@/lib/auth/access'
import {
  createOrganizationApiToken,
  listOrganizationApiTokens,
  MAX_ACTIVE_API_TOKENS,
} from '@/lib/api-tokens/management'
import { createClient } from '@/lib/supabase/server'

const CreateTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scope: z.enum(['read', 'write']).default('read'),
  expiresAt: z.string().datetime({ offset: true }).nullable().default(null),
}).superRefine((value, context) => {
  if (value.expiresAt && new Date(value.expiresAt).getTime() <= Date.now() + 5 * 60 * 1000) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Expiration must be at least five minutes in the future' })
  }
})

async function authorize(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const access = await assertOrgAccess(user.id, orgId, 'admin')
  if (!access.ok) return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { ok: true as const, user }
}

export async function GET(_request: Request, { params }: { params: { orgId: string } }) {
  const auth = await authorize(params.orgId)
  if (!auth.ok) return auth.response
  try {
    const tokens = await listOrganizationApiTokens(params.orgId)
    return NextResponse.json({ data: tokens }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Failed to list API tokens' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { orgId: string } }) {
  const auth = await authorize(params.orgId)
  if (!auth.ok) return auth.response
  const parsed = CreateTokenSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await createOrganizationApiToken({
    orgId: params.orgId,
    userId: auth.user.id,
    name: parsed.data.name,
    scope: parsed.data.scope,
    expiresAt: parsed.data.expiresAt,
  })
  if ('error' in result) {
    const message = result.error === 'limit'
      ? `An organization may have at most ${MAX_ACTIVE_API_TOKENS} active API tokens`
      : 'Failed to create API token'
    return NextResponse.json({ error: message }, { status: result.error === 'limit' ? 409 : 500 })
  }
  return NextResponse.json(
    { data: result },
    { status: 201, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
  )
}
