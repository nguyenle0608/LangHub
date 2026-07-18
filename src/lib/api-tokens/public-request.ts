import { NextResponse } from 'next/server'
import { apiScopeAllows } from './access'
import { authenticateApiToken, type ApiTokenContext, type ApiTokenScope, type ApiTokenStore } from './auth'
import { apiError, getRequestId, unauthorizedApiResponse } from './responses'
import { apiRateLimitHeaders, consumeApiRateLimit, type ApiRateLimitStore, type ApiRequestKind } from './rate-limit'

export type PublicApiAuthorization =
  | { ok: true; context: ApiTokenContext; requestId: string; rateLimitHeaders: Record<string, string> }
  | { ok: false; response: NextResponse }

export async function authorizePublicApiRequest(
  request: Request,
  requiredScope: ApiTokenScope,
  options: { tokenStore?: ApiTokenStore; rateLimitStore?: ApiRateLimitStore; now?: Date } = {}
): Promise<PublicApiAuthorization> {
  if (process.env.PUBLIC_API_ENABLED !== 'true') {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } }) }
  }
  const requestId = getRequestId(request)
  const context = await authenticateApiToken(request, { store: options.tokenStore, now: options.now })
  if (!context) return { ok: false, response: unauthorizedApiResponse(requestId) }
  if (!apiScopeAllows(context.scope, requiredScope)) {
    return { ok: false, response: apiError(403, 'forbidden', 'Insufficient token scope', requestId) }
  }

  const kind: ApiRequestKind = requiredScope === 'write' ? 'write' : 'read'
  const rateLimit = await consumeApiRateLimit(context.tokenId, kind, options.rateLimitStore)
  if (!rateLimit) return { ok: false, response: apiError(500, 'internal_error', 'Request could not be processed', requestId) }
  const headers = apiRateLimitHeaders(rateLimit)
  if (!rateLimit.allowed) {
    return { ok: false, response: apiError(429, 'rate_limited', 'Rate limit exceeded', requestId, headers) }
  }
  return { ok: true, context, requestId, rateLimitHeaders: headers }
}

export function publicApiHeaders(auth: Extract<PublicApiAuthorization, { ok: true }>): Record<string, string> {
  return { 'Cache-Control': 'no-store', 'X-Request-ID': auth.requestId, ...auth.rateLimitHeaders }
}

