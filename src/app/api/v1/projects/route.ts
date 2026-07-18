import { NextResponse } from 'next/server'
// Bearer authentication, feature flags, and rate limits are request-time state.
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { authorizePublicApiRequest, decodeProjectCursor, encodeProjectCursor, publicApiHeaders } from '@/lib/api-tokens'
import { apiError } from '@/lib/api-tokens/responses'
import { createAdminClient } from '@/lib/supabase/admin'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(500).optional(),
})

export async function GET(request: Request) {
  const auth = await authorizePublicApiRequest(request, 'read')
  if (!auth.ok) return auth.response
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({ limit: url.searchParams.get('limit') ?? undefined, cursor: url.searchParams.get('cursor') ?? undefined })
  if (!parsed.success) return apiError(400, 'validation_error', 'Invalid pagination parameters', auth.requestId)
  const cursor = parsed.data.cursor ? decodeProjectCursor(parsed.data.cursor, auth.context.orgId) : null
  if (parsed.data.cursor && !cursor) return apiError(400, 'validation_error', 'Invalid cursor', auth.requestId)

  const admin = createAdminClient()
  let query = admin
    .from('projects')
    .select('id, name, slug, description, base_locale, created_at')
    .eq('org_id', auth.context.orgId)
    .order('id', { ascending: true })
    .limit(parsed.data.limit + 1)
  if (cursor) query = query.gt('id', cursor.id)
  const { data, error } = await query
  if (error) return apiError(500, 'internal_error', 'Failed to list projects', auth.requestId)

  const rows = data ?? []
  const hasMore = rows.length > parsed.data.limit
  const page = hasMore ? rows.slice(0, parsed.data.limit) : rows
  const last = page.at(-1)
  return NextResponse.json({
    data: page.map((project) => ({
      id: project.id, name: project.name, slug: project.slug, description: project.description,
      baseLocale: project.base_locale, createdAt: project.created_at,
    })),
    pagination: { nextCursor: hasMore && last ? encodeProjectCursor({ id: last.id, orgId: auth.context.orgId }) : null },
  }, { headers: publicApiHeaders(auth) })
}
