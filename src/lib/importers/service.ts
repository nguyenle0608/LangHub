import { createAdminClient } from '@/lib/supabase/admin'
import { createSnapshot } from '@/lib/versions/snapshot'
import type { Json } from '@/types/database'
import type { ApiTokenContext } from '@/lib/api-tokens/auth'
import { validateImportEntries, ImportValidationError } from './parse'

export type ImportActor =
  | { kind: 'user'; userId: string; orgId: string }
  | { kind: 'api_token'; context: ApiTokenContext; requestId: string }

export interface ImportCommand {
  projectId: string
  branchId: string
  localeId: string
  filename: string
  entries: Array<{ key: string; value: string }>
  skipKeys?: string[]
  snapshotName?: string | null
  skipSnapshot?: boolean
  actor: ImportActor
  idempotency?: { key: string; requestHash: string }
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  total: number
  snapshotId?: string
  filename: string
}

async function validateImportResources(command: ImportCommand): Promise<string> {
  const admin = createAdminClient()
  const [{ data: project }, { data: branch }, { data: locale }] = await Promise.all([
    admin.from('projects').select('org_id').eq('id', command.projectId).maybeSingle(),
    admin.from('branches').select('project_id').eq('id', command.branchId).maybeSingle(),
    admin.from('locales').select('project_id').eq('id', command.localeId).maybeSingle(),
  ])
  if (!project?.org_id || branch?.project_id !== command.projectId || locale?.project_id !== command.projectId) {
    throw new ImportValidationError('Project resource not found', 'resource')
  }
  const actorOrgId = command.actor.kind === 'api_token' ? command.actor.context.orgId : command.actor.orgId
  if (project.org_id !== actorOrgId) throw new ImportValidationError('Project resource not found', 'resource')
  return project.org_id
}

function parseRpcResult(value: Json): { created: number; updated: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid import response')
  return { created: Number(value.created ?? 0), updated: Number(value.updated ?? 0) }
}

export async function executeImport(command: ImportCommand): Promise<ImportResult> {
  validateImportEntries(command.entries)
  const orgId = await validateImportResources(command)
  if (command.actor.kind === 'api_token' && command.actor.context.scope !== 'write') {
    throw new ImportValidationError('Insufficient token scope', 'resource')
  }
  if (command.actor.kind === 'api_token' && !command.idempotency) {
    throw new ImportValidationError('Idempotency reservation is required', 'resource')
  }
  const skipKeys = new Set(command.skipKeys ?? [])
  const skipped = command.entries.filter((entry) => skipKeys.has(entry.key) && entry.value.trim()).length
  const entries = command.entries.filter((entry) => !skipKeys.has(entry.key))
  if (entries.length === 0) throw new ImportValidationError('No keys selected for import')

  const userId = command.actor.kind === 'user' ? command.actor.userId : command.actor.context.createdBy
  let snapshotId: string | undefined
  if (!command.skipSnapshot || command.actor.kind === 'api_token') {
    const snapshot = await createSnapshot(command.projectId, userId, {
      name: command.snapshotName ?? `Auto: Before import "${command.filename}"`,
      tag: 'auto_import', branchId: command.branchId,
    })
    if ('error' in snapshot) {
      if (command.actor.kind === 'api_token') await recordImportFailure(command, orgId, 'snapshot_failed')
      throw new Error(`Snapshot failed: ${snapshot.error}`)
    }
    snapshotId = snapshot.id
  }

  const admin = createAdminClient()
  const total = entries.filter((entry) => entry.value.trim()).length
  const rpcResult = command.actor.kind === 'api_token'
    ? await admin.rpc('apply_idempotent_translation_import', {
        p_project_id: command.projectId, p_branch_id: command.branchId, p_locale_id: command.localeId,
        p_entries: entries as unknown as Json, p_actor_user_id: userId,
        p_api_token_id: command.actor.context.tokenId, p_request_id: command.actor.requestId,
        p_idempotency_key: command.idempotency!.key, p_request_hash: command.idempotency!.requestHash,
        p_snapshot_id: snapshotId!, p_filename: command.filename, p_skipped: skipped, p_total: total,
      })
    : await admin.rpc('apply_translation_import', {
        p_project_id: command.projectId, p_branch_id: command.branchId, p_locale_id: command.localeId,
        p_entries: entries as unknown as Json, p_actor_user_id: userId,
        p_api_token_id: null, p_request_id: crypto.randomUUID(),
      })
  const { data, error } = rpcResult
  if (error || !data) {
    if (command.actor.kind === 'api_token') await recordImportFailure(command, orgId, 'mutation_failed')
    throw new Error('Import transaction failed')
  }
  const counts = parseRpcResult(data)
  return {
    ...counts,
    skipped,
    total,
    snapshotId,
    filename: command.filename,
  }
}

async function recordImportFailure(command: ImportCommand, orgId: string, reason: string) {
  if (command.actor.kind !== 'api_token') return
  const admin = createAdminClient()
  await admin.from('api_audit_events').insert({
    token_id: command.actor.context.tokenId,
    org_id: orgId,
    project_id: command.projectId,
    branch_id: command.branchId,
    request_id: command.actor.requestId,
    action: 'translations.import',
    outcome: 'failure',
    metadata: { reason, locale_id: command.localeId },
  })
}
