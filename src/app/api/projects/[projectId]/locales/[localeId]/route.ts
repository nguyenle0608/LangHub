import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { removeLocale, setBaseLocale } from '@/lib/supabase/queries/projects'

export async function PATCH(
  _request: Request,
  { params }: { params: { projectId: string; localeId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await setBaseLocale(params.projectId, params.localeId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { projectId: string; localeId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: locale } = await supabase
    .from('locales')
    .select('is_base')
    .eq('id', params.localeId)
    .eq('project_id', params.projectId)
    .single()

  if (locale?.is_base) {
    return NextResponse.json({ error: 'Cannot delete base locale' }, { status: 400 })
  }

  const result = await removeLocale(params.localeId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true })
}
