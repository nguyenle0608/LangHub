import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordSuggestionUsage } from '@/lib/translation-assistance/service'
import { isFlagEnabled } from '@/lib/env-flags'

export async function POST(
  _request: Request,
  { params }: { params: { projectId: string; entryId: string } }
) {
  if (!isFlagEnabled(process.env.TRANSLATION_ASSISTANCE_ENABLED)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const recorded = await recordSuggestionUsage(user.id, params.projectId, params.entryId)
  if (recorded == null) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!recorded) return NextResponse.json({ error: 'Unable to record suggestion usage' }, { status: 500 })
  return NextResponse.json({ data: { recorded: true } }, { headers: { 'Cache-Control': 'no-store' } })
}
