import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { assertBranchAccess, assertLocalesAccess, assertProjectAccess } from '@/lib/auth/access'
import { resolveBranchId } from '@/lib/branches/queries'
import { ExportDataQueryError } from '@/lib/exporters/data'
import { executeExport, ExportServiceError } from '@/lib/exporters/service'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ExportSchema = z.object({
  projectId: z.string().min(1),
  branchId: z.string().min(1).optional(),
  localeIds: z.array(z.string().min(1)).min(1).max(100),
  format: z.enum(['json', 'arb', 'csv', 'yaml', 'android', 'ios']),
  filter: z.enum(['all', 'approved', 'reviewed_approved']),
  nested: z.boolean().optional(),
  jsonStructure: z.enum(['monolithic', 'namespaced']).optional(),
  includeEmpty: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = ExportSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { projectId, localeIds } = parsed.data
  const projectAccess = await assertProjectAccess(user.id, projectId, 'viewer')
  if (!projectAccess.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const branchId = await resolveBranchId(projectId, parsed.data.branchId)
  if (!branchId) return NextResponse.json({ error: 'No branch found for project' }, { status: 400 })
  const [branchAccess, localeAccess] = await Promise.all([
    assertBranchAccess(user.id, branchId, 'viewer', projectId),
    assertLocalesAccess(user.id, localeIds, 'viewer', projectId),
  ])
  if (!branchAccess.ok || !localeAccess.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const artifact = await executeExport(createAdminClient(), { ...parsed.data, branchId })
    return new NextResponse(artifact.body as BodyInit, {
      headers: {
        'Content-Type': artifact.contentType,
        'Content-Disposition': `attachment; filename="${artifact.filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof ExportDataQueryError || (error instanceof ExportServiceError && error.code === 'query_failed')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (error instanceof ExportServiceError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: 'Failed to export translations' }, { status: 500 })
  }
}
