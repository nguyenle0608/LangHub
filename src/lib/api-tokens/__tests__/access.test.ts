import { describe, expect, it } from 'vitest'
import { apiScopeAllows, assertApiProjectAccess, assertApiResourcesAccess, type ApiResourceStore } from '../access'
import type { ApiTokenContext } from '../auth'

const context: ApiTokenContext = { tokenId: 'token-1', orgId: 'org-a', scope: 'read', createdBy: null }

function store(values: { org?: string | null; branch?: string | null; locale?: string | null }): ApiResourceStore {
  return {
    projectOrg: async () => values.org ?? null,
    branchProject: async () => values.branch ?? null,
    localeProject: async () => values.locale ?? null,
  }
}

describe('API scope and tenant gates', () => {
  it('treats write as a superset of read', () => {
    expect(apiScopeAllows('read', 'read')).toBe(true)
    expect(apiScopeAllows('read', 'write')).toBe(false)
    expect(apiScopeAllows('write', 'read')).toBe(true)
    expect(apiScopeAllows('write', 'write')).toBe(true)
  })

  it('allows only projects in the token organization', async () => {
    await expect(assertApiProjectAccess(context, 'project-a', store({ org: 'org-a' }))).resolves.toBe(true)
    await expect(assertApiProjectAccess(context, 'project-b', store({ org: 'org-b' }))).resolves.toBe(false)
  })

  it('requires branch and locale to belong to the authorized project', async () => {
    await expect(assertApiResourcesAccess(context, 'project-a', { branchId: 'branch-a', localeId: 'locale-a' }, store({ org: 'org-a', branch: 'project-a', locale: 'project-a' }))).resolves.toBe(true)
    await expect(assertApiResourcesAccess(context, 'project-a', { branchId: 'branch-b', localeId: 'locale-a' }, store({ org: 'org-a', branch: 'project-b', locale: 'project-a' }))).resolves.toBe(false)
    await expect(assertApiResourcesAccess(context, 'project-a', { branchId: 'branch-a', localeId: 'locale-b' }, store({ org: 'org-a', branch: 'project-a', locale: 'project-b' }))).resolves.toBe(false)
  })

  it('stops at the project gate for a cross-org request', async () => {
    let childReads = 0
    const crossOrgStore: ApiResourceStore = {
      projectOrg: async () => 'org-b',
      branchProject: async () => { childReads += 1; return 'project-a' },
      localeProject: async () => { childReads += 1; return 'project-a' },
    }
    await expect(assertApiResourcesAccess(context, 'project-a', { branchId: 'branch-a', localeId: 'locale-a' }, crossOrgStore)).resolves.toBe(false)
    expect(childReads).toBe(0)
  })
})

