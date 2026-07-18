import { NextResponse } from 'next/server'
// Bearer authentication, feature flags, and rate limits are request-time state.
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { authorizePublicApiRequest, publicApiHeaders, resolveApiBranch, resolveApiLocales } from '@/lib/api-tokens'
import { apiError } from '@/lib/api-tokens/responses'
import { buildExportLookup, ExportDataQueryError, fetchExportData } from '@/lib/exporters/data'
import { createAdminClient } from '@/lib/supabase/admin'

const QuerySchema = z.object({
  locale: z.string().min(1).max(50),
  branch: z.string().min(1).max(100).optional(),
  filter: z.enum(['all', 'approved', 'reviewed_approved']).default('all'),
  includeEmpty: z.enum(['true', 'false']).default('false'),
})

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizePublicApiRequest(request, 'read')
  if (!auth.ok) return auth.response
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    locale: url.searchParams.get('locale') ?? undefined,
    branch: url.searchParams.get('branch') ?? undefined,
    filter: url.searchParams.get('filter') ?? undefined,
    includeEmpty: url.searchParams.get('includeEmpty') ?? undefined,
  })
  if (!parsed.success) return apiError(400, 'validation_error', 'Invalid translation query', auth.requestId)

  const [branchId, locales] = await Promise.all([
    resolveApiBranch(auth.context, params.id, parsed.data.branch),
    resolveApiLocales(auth.context, params.id, [parsed.data.locale]),
  ])
  if (!branchId || !locales?.[0]) return apiError(404, 'not_found', 'Project resource not found', auth.requestId)
  try {
    const locale = locales[0]
    const { keys, translations } = await fetchExportData(createAdminClient(), branchId, [locale.id])
    const values = buildExportLookup(keys, translations, parsed.data.filter, {
      includeEmpty: parsed.data.includeEmpty === 'true', localeIds: [locale.id],
    }).get(locale.id) ?? {}
    const deterministic = Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))
    return NextResponse.json({ data: deterministic, meta: { projectId: params.id, branchId, locale: locale.code } }, { headers: publicApiHeaders(auth) })
  } catch (error) {
    const message = error instanceof ExportDataQueryError ? error.message : 'Failed to load translations'
    return apiError(500, 'internal_error', message, auth.requestId)
  }
}
