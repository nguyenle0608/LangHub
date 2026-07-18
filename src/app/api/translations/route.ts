import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateTranslation } from '@/lib/supabase/queries/translations'
import { assertTranslationItemsAccess } from '@/lib/auth/access'

const PatchSchema = z.object({
  branchId: z.string().uuid(),
  keyId: z.string().uuid(),
  localeId: z.string().uuid(),
  value: z.string(),
  status: z.enum(['empty', 'pending', 'reviewed', 'approved']),
})

// Single translation update
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { branchId, keyId, localeId, value, status } = parsed.data
  const access = await assertTranslationItemsAccess(user.id, branchId, [keyId], [localeId])
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await updateTranslation(branchId, keyId, localeId, value, status, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}

const STATUS_ENUM = z.enum(['empty', 'pending', 'reviewed', 'approved'])

const BulkUpsertSchema = z.object({
  branchId: z.string().uuid(),
  // Default status applied to items that don't specify their own
  status: STATUS_ENUM.default('approved'),
  items: z.array(z.object({
    keyId: z.string().uuid(),
    localeId: z.string().uuid(),
    value: z.string(),
    status: STATUS_ENUM.optional(),
  })).min(1).max(5000),
})

// Bulk upsert — single DB upsert for all items.
// Used by: Approve all / Review all (top-level status) and paste (per-item status).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = BulkUpsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const access = await assertTranslationItemsAccess(
    user.id,
    parsed.data.branchId,
    parsed.data.items.map((item) => item.keyId),
    parsed.data.items.map((item) => item.localeId)
  )
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const rows = parsed.data.items.map((item) => ({
    branch_id: parsed.data.branchId,
    key_id: item.keyId,
    locale_id: item.localeId,
    value: item.value,
    status: item.status ?? parsed.data.status,
    updated_at: now,
  }))

  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin
      .from('translations')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'branch_id,key_id,locale_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: rows.length })
}
