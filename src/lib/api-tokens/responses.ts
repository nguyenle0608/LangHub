import { NextResponse } from 'next/server'

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'rate_limited'
  | 'conflict'
  | 'internal_error'

export function getRequestId(request: Pick<Request, 'headers'>): string {
  const incoming = request.headers.get('x-request-id')
  return incoming && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incoming)
    ? incoming
    : crypto.randomUUID()
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
  headers?: HeadersInit
) {
  return NextResponse.json(
    { error: { code, message, requestId } },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId, ...headers } }
  )
}

export function unauthorizedApiResponse(requestId: string) {
  return apiError(401, 'unauthorized', 'Invalid API credential', requestId)
}
