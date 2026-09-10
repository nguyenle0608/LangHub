import { NextResponse } from 'next/server'
// Bearer authentication, feature flags, and rate limits are request-time state.
export const dynamic = 'force-dynamic'
import { authorizePublicApiRequest, publicApiHeaders } from '@/lib/api-tokens'
import { apiError } from '@/lib/api-tokens/responses'
import { assertApiProjectAccess } from '@/lib/api-tokens/access'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The locales a project has.
 *
 * Every other v1 route takes a locale and answers 404 when it does not exist —
 * correctly refusing to say which part of a guess was right, since that is how
 * a resource gets enumerated by someone who should not be able to. The cost was
 * that a caller holding a valid token had no way to find out what to ask for,
 * and a typo in a locale code was indistinguishable from a wrong project id.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizePublicApiRequest(request, 'read')
  if (!auth.ok) return auth.response

  if (!(await assertApiProjectAccess(auth.context, params.id))) {
    return apiError(404, 'not_found', 'Project resource not found', auth.requestId)
  }

  const { data, error } = await createAdminClient()
    .from('locales')
    .select('code, name, is_base')
    .eq('project_id', params.id)
    .order('code', { ascending: true })

  if (error) return apiError(500, 'internal_error', 'Failed to load locales', auth.requestId)

  return NextResponse.json(
    {
      data: (data ?? []).map((locale) => ({
        code: locale.code,
        name: locale.name,
        isBase: locale.is_base ?? false,
      })),
    },
    { headers: publicApiHeaders(auth) }
  )
}
