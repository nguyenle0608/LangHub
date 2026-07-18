import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  projectOrg: 'org-a', branchProject: 'project-a', localeProject: 'project-a',
  snapshot: vi.fn(), rpc: vi.fn(), auditInsert: vi.fn(),
}))

vi.mock('@/lib/versions/snapshot', () => ({ createSnapshot: mocks.snapshot }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: table === 'projects' ? { org_id: mocks.projectOrg } : table === 'branches' ? { project_id: mocks.branchProject } : { project_id: mocks.localeProject }, error: null }),
        insert: mocks.auditInsert,
      }
      return query
    },
    rpc: mocks.rpc,
  }),
}))

import { executeImport } from '../service'

const base = {
  projectId: 'project-a', branchId: 'branch-a', localeId: 'locale-a', filename: 'en.json',
  entries: [{ key: 'hello.world', value: 'Hello' }],
  actor: { kind: 'user' as const, userId: 'user-a', orgId: 'org-a' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.projectOrg = 'org-a'; mocks.branchProject = 'project-a'; mocks.localeProject = 'project-a'
  mocks.snapshot.mockResolvedValue({ id: 'snapshot-a' })
  mocks.rpc.mockResolvedValue({ data: { created: 1, updated: 0, total: 1 }, error: null })
  mocks.auditInsert.mockResolvedValue({ error: null })
})

describe('shared import service', () => {
  it('snapshots before invoking the transactional user import RPC', async () => {
    await expect(executeImport(base)).resolves.toMatchObject({ created: 1, snapshotId: 'snapshot-a', filename: 'en.json' })
    expect(mocks.snapshot.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]!)
    expect(mocks.rpc).toHaveBeenCalledWith('apply_translation_import', expect.objectContaining({ p_actor_user_id: 'user-a', p_api_token_id: null }))
  })

  it('rejects a mismatched branch or locale before snapshot and mutation', async () => {
    mocks.branchProject = 'project-b'
    await expect(executeImport(base)).rejects.toThrow('Project resource not found')
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('does not mutate when snapshot creation fails', async () => {
    mocks.snapshot.mockResolvedValue({ error: 'snapshot unavailable' })
    await expect(executeImport(base)).rejects.toThrow('Snapshot failed')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('reports transaction failure without partial success', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'rollback' } })
    await expect(executeImport(base)).rejects.toThrow('Import transaction failed')
  })

  it('uses the atomic idempotent RPC and attributes a write token', async () => {
    const command = {
      ...base,
      actor: { kind: 'api_token' as const, requestId: '00000000-0000-4000-8000-000000000010', context: { tokenId: 'token-a', orgId: 'org-a', scope: 'write' as const, createdBy: 'user-a' } },
      idempotency: { key: 'request-123', requestHash: 'a'.repeat(64) },
    }
    await executeImport(command)
    expect(mocks.rpc).toHaveBeenCalledWith('apply_idempotent_translation_import', expect.objectContaining({
      p_api_token_id: 'token-a', p_idempotency_key: 'request-123', p_request_hash: 'a'.repeat(64), p_snapshot_id: 'snapshot-a',
    }))
  })

  it('denies a read token before snapshot or mutation', async () => {
    const command = {
      ...base,
      actor: { kind: 'api_token' as const, requestId: '00000000-0000-4000-8000-000000000010', context: { tokenId: 'token-a', orgId: 'org-a', scope: 'read' as const, createdBy: null } },
      idempotency: { key: 'request-123', requestHash: 'a'.repeat(64) },
    }
    await expect(executeImport(command)).rejects.toThrow('Insufficient token scope')
    expect(mocks.snapshot).not.toHaveBeenCalled()
  })

  it('requires a reservation before snapshotting a write-token import', async () => {
    const command = {
      ...base,
      actor: { kind: 'api_token' as const, requestId: '00000000-0000-4000-8000-000000000010', context: { tokenId: 'token-a', orgId: 'org-a', scope: 'write' as const, createdBy: null } },
    }
    await expect(executeImport(command)).rejects.toThrow('Idempotency reservation is required')
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
