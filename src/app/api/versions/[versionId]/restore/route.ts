import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { restoreSnapshot } from '@/lib/versions/snapshot'

const RestoreSchema = z.object({
  projectId: z.string().uuid(),
  scope: z.enum(['all', 'locale', 'keys']),
  localeCode: z.string().optional(),
  keyNames: z.array(z.string()).optional(),
  createBackupFirst: z.boolean().default(true),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { versionId } = await params
  const body = await req.json() as unknown
  const parsed = RestoreSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await restoreSnapshot(versionId, parsed.data.projectId, user.id, {
    scope: parsed.data.scope,
    localeCode: parsed.data.localeCode,
    keyNames: parsed.data.keyNames,
    createBackupFirst: parsed.data.createBackupFirst,
  })

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ data: result })
}
