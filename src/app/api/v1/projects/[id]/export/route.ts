import { NextResponse } from 'next/server'
// Bearer authentication, feature flags, and rate limits are request-time state.
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { authorizePublicApiRequest, publicApiHeaders, resolveApiBranch, resolveApiLocales } from '@/lib/api-tokens'
import { apiError } from '@/lib/api-tokens/responses'
import { ExportDataQueryError } from '@/lib/exporters/data'
import { executeExport, ExportServiceError } from '@/lib/exporters/service'
import { createAdminClient } from '@/lib/supabase/admin'

const QuerySchema = z.object({
  locales: z.array(z.string().min(1).max(50)).min(1).max(100),
  branch: z.string().min(1).max(100).optional(),
  format: z.enum(['json', 'arb', 'csv', 'yaml', 'android', 'ios']).default('json'),
  filter: z.enum(['all', 'approved', 'reviewed_approved']).default('all'),
  nested: z.enum(['true', 'false']).default('true'),
  jsonStructure: z.enum(['monolithic', 'namespaced']).default('monolithic'),
  includeEmpty: z.enum(['true', 'false']).default('false'),
})

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizePublicApiRequest(request, 'read')
  if (!auth.ok) return auth.response
  const url = new URL(request.url)
  const repeated = url.searchParams.getAll('locale')
  const locales = repeated.length ? repeated : (url.searchParams.get('locales')?.split(',').filter(Boolean) ?? [])
  const parsed = QuerySchema.safeParse({
    locales, branch: url.searchParams.get('branch') ?? undefined,
    format: url.searchParams.get('format') ?? undefined, filter: url.searchParams.get('filter') ?? undefined,
    nested: url.searchParams.get('nested') ?? undefined, jsonStructure: url.searchParams.get('jsonStructure') ?? undefined,
    includeEmpty: url.searchParams.get('includeEmpty') ?? undefined,
  })
  if (!parsed.success) return apiError(400, 'validation_error', 'Invalid export query', auth.requestId)
  const [branchId, resolvedLocales] = await Promise.all([
    resolveApiBranch(auth.context, params.id, parsed.data.branch),
    resolveApiLocales(auth.context, params.id, parsed.data.locales),
  ])
  if (!branchId || !resolvedLocales) return apiError(404, 'not_found', 'Project resource not found', auth.requestId)

  try {
    const artifact = await executeExport(createAdminClient(), {
      projectId: params.id, branchId, localeIds: resolvedLocales.map((locale) => locale.id),
      format: parsed.data.format, filter: parsed.data.filter,
      nested: parsed.data.nested === 'true', jsonStructure: parsed.data.jsonStructure,
      includeEmpty: parsed.data.includeEmpty === 'true',
    })
    return new NextResponse(artifact.body as BodyInit, {
      headers: { ...publicApiHeaders(auth), 'Content-Type': artifact.contentType, 'Content-Disposition': `attachment; filename="${artifact.filename}"` },
    })
  } catch (error) {
    if (error instanceof ExportDataQueryError || error instanceof ExportServiceError) {
      const status = error instanceof ExportServiceError && error.code !== 'query_failed' ? 400 : 500
      return apiError(status, status === 400 ? 'validation_error' : 'internal_error', error.message, auth.requestId)
    }
    return apiError(500, 'internal_error', 'Failed to export translations', auth.requestId)
  }
}
