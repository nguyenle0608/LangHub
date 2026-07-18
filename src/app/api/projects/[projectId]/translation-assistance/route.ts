import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getTranslationAssistance } from '@/lib/translation-assistance/service'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  branchId: z.string().uuid(),
  keyId: z.string().uuid(),
  localeId: z.string().uuid(),
})

export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  if (process.env.TRANSLATION_ASSISTANCE_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    branchId: url.searchParams.get('branchId'),
    keyId: url.searchParams.get('keyId'),
    localeId: url.searchParams.get('localeId'),
  })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid assistance query' }, { status: 400 })
  try {
    const data = await getTranslationAssistance({
      userId: user.id,
      projectId: params.projectId,
      branchId: parsed.data.branchId,
      keyId: parsed.data.keyId,
      targetLocaleId: parsed.data.localeId,
    })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Translation assistance unavailable' }, { status: 503 })
  }
}
