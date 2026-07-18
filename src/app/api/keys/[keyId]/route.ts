import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { renameKey, updateKeyMeta } from '@/lib/supabase/queries/keys'
import { assertKeysAccess } from '@/lib/auth/access'

const PatchSchema = z.object({
  key: z.string().min(1).max(200).regex(/^[a-z0-9_.]+$/).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  charLimit: z.number().int().positive().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keyId } = await params
  const access = await assertKeysAccess(user.id, [keyId], 'translator')
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as unknown
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { key, ...meta } = parsed.data

  if (key) {
    const result = await renameKey(keyId, key)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  }

  if (Object.keys(meta).length > 0) {
    const result = await updateKeyMeta(keyId, {
      description: meta.description,
      tags: meta.tags,
      platforms: meta.platforms,
      charLimit: meta.charLimit,
    })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keyId } = await params
  const access = await assertKeysAccess(user.id, [keyId], 'admin')
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('translation_keys').delete().eq('id', keyId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
