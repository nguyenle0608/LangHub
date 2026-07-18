import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertTranslationItemsAccess } from '@/lib/auth/access'

const Schema = z.object({
  branchId: z.string().uuid(),
  items: z.array(z.object({
    keyId: z.string().uuid(),
    localeId: z.string().uuid(),
    value: z.string(),
  })).min(1).max(1000),
})

// Reset target translations to 'pending' when source text changes
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as unknown
  const parsed = Schema.safeParse(body)
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
    status: 'pending' as const,
    updated_at: now,
  }))

  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin
      .from('translations')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'branch_id,key_id,locale_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invalidated: rows.length })
}
