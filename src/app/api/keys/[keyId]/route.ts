import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { renameKey, updateKeyMeta } from '@/lib/supabase/queries/keys'
import { assertKeysAccess } from '@/lib/auth/access'
import { TRANSLATION_KEY_MAX_LENGTH, TRANSLATION_KEY_PATTERN } from '@/lib/translation-keys'
import { zodErrorResponse } from '@/lib/api/validation-error'

const PatchSchema = z.object({
  key: z.string().min(1).max(TRANSLATION_KEY_MAX_LENGTH).regex(TRANSLATION_KEY_PATTERN).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  charLimit: z.number().int().positive().nullable().optional(),
})

/**
 * Fetch one key's metadata.
 *
 * The editor's realtime channel carries translation rows only, so a key's
 * name, description, tags and platforms can go stale in an open dialog while
 * someone else edits them. The detail panel re-reads through here.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keyId } = await params
  const access = await assertKeysAccess(user.id, [keyId], 'viewer')
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('translation_keys')
    .select('id, key, description, tags, platforms, char_limit')
    .eq('id', keyId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

  return NextResponse.json({ data })
}

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
  if (!parsed.success) return zodErrorResponse(parsed.error)

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
