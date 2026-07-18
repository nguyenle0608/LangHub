import { NextResponse } from 'next/server'
// Bearer authentication, feature flags, and rate limits are request-time state.
export const dynamic = 'force-dynamic'
import { authorizePublicApiRequest, publicApiHeaders, resolveApiBranch, resolveApiLocales } from '@/lib/api-tokens'
import { apiError } from '@/lib/api-tokens/responses'
import { failImportIdempotency, hashImportRequest, IDEMPOTENCY_KEY_PATTERN, reserveImportIdempotency } from '@/lib/importers/idempotency'
import { assertImportBodySize, IMPORT_FORMATS, ImportValidationError, isImportFile, MAX_PUBLIC_IMPORT_BYTES, parseImportContent } from '@/lib/importers/parse'
import { executeImport } from '@/lib/importers/service'
import type { JsonImportStructure } from '@/lib/localization-namespaces'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizePublicApiRequest(request, 'write')
  if (!auth.ok) return auth.response
  const headers = publicApiHeaders(auth)
  const idempotencyKey = request.headers.get('idempotency-key')
  if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return apiError(400, 'validation_error', 'A valid Idempotency-Key header is required', auth.requestId, headers)
  }
  const contentLength = Number(request.headers.get('content-length'))
  if (!Number.isSafeInteger(contentLength) || contentLength < 1) {
    return apiError(400, 'validation_error', 'Content-Length is required', auth.requestId, headers)
  }
  try { assertImportBodySize(contentLength) } catch (error) {
    return apiError(413, 'validation_error', error instanceof Error ? error.message : 'Payload too large', auth.requestId, headers)
  }

  let formData: FormData
  try { formData = await request.formData() } catch {
    return apiError(400, 'validation_error', 'Invalid multipart form data', auth.requestId, headers)
  }
  const file = formData.get('file')
  const localeRef = formData.get('locale')
  const branchRef = formData.get('branch')
  const format = formData.get('format')
  if (!isImportFile(file) || typeof localeRef !== 'string' || typeof format !== 'string') {
    return apiError(400, 'validation_error', 'file, locale, and format are required', auth.requestId, headers)
  }
  if (file.size > MAX_PUBLIC_IMPORT_BYTES || !IMPORT_FORMATS.includes(format as typeof IMPORT_FORMATS[number])) {
    return apiError(file.size > MAX_PUBLIC_IMPORT_BYTES ? 413 : 400, 'validation_error', file.size > MAX_PUBLIC_IMPORT_BYTES ? 'Import file is too large' : 'Unsupported import format', auth.requestId, headers)
  }

  const [branchId, locales] = await Promise.all([
    resolveApiBranch(auth.context, params.id, typeof branchRef === 'string' ? branchRef : null),
    resolveApiLocales(auth.context, params.id, [localeRef]),
  ])
  if (!branchId || !locales?.[0]) return apiError(404, 'not_found', 'Project resource not found', auth.requestId, headers)

  let reservationMade = false
  try {
    const namespace = formData.get('namespace')
    const importStructure = (formData.get('importStructure') as JsonImportStructure | null) ?? 'monolithic'
    if (importStructure !== 'monolithic' && importStructure !== 'namespaced') {
      throw new ImportValidationError('Unsupported import structure')
    }
    const parsed = parseImportContent({
      content: await file.text(), filename: file.name,
      format: format as typeof IMPORT_FORMATS[number], localeCode: locales[0].code,
      namespace: typeof namespace === 'string' ? namespace : null, importStructure,
    })
    const requestHash = hashImportRequest({
      projectId: params.id, branchId, localeId: locales[0].id, format,
      filename: file.name, entries: parsed.entries,
    })
    const reservation = await reserveImportIdempotency({ tokenId: auth.context.tokenId, key: idempotencyKey, requestHash })
    if (reservation.kind === 'replay') {
      return NextResponse.json(reservation.body, { status: reservation.status, headers: { ...headers, 'Idempotent-Replayed': 'true' } })
    }
    if (reservation.kind === 'conflict') {
      const message = reservation.reason === 'content_changed'
        ? 'Idempotency key was used with different content'
        : reservation.reason === 'in_progress'
          ? 'An identical request is still in progress'
          : 'This idempotency key cannot be retried; use a new key'
      return apiError(409, 'conflict', message, auth.requestId, headers)
    }
    reservationMade = true
    const result = await executeImport({
      projectId: params.id, branchId, localeId: locales[0].id, filename: file.name,
      entries: parsed.entries, actor: { kind: 'api_token', context: auth.context, requestId: auth.requestId },
      idempotency: { key: idempotencyKey, requestHash },
    })
    const body = { data: result }
    return NextResponse.json(body, { headers })
  } catch (error) {
    if (reservationMade) await failImportIdempotency(auth.context.tokenId, idempotencyKey)
    if (error instanceof ImportValidationError) {
      const status = error.code === 'bounds' ? 413 : error.code === 'resource' ? 404 : 400
      return apiError(status, status === 404 ? 'not_found' : 'validation_error', error.message, auth.requestId, headers)
    }
    return apiError(500, 'internal_error', 'Import failed', auth.requestId, headers)
  }
}
