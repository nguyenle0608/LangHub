import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTranslationHistoryForKey } from '@/lib/supabase/queries/translations'
import { assertKeysAccess } from '@/lib/auth/access'

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

  const history = await getTranslationHistoryForKey(keyId)
  return NextResponse.json({ data: history })
}
