import { describe, expect, it } from 'vitest'
import { decodeProjectCursor, encodeProjectCursor } from '../cursor'

const orgA = '00000000-0000-4000-8000-000000000001'
const orgB = '00000000-0000-4000-8000-000000000002'
const project = '00000000-0000-4000-8000-000000000003'

describe('project cursors', () => {
  it('round trips a cursor bound to its organization', () => {
    const cursor = encodeProjectCursor({ id: project, orgId: orgA })
    expect(decodeProjectCursor(cursor, orgA)).toEqual({ id: project })
    expect(decodeProjectCursor(cursor, orgB)).toBeNull()
  })

  it.each(['not-base64', Buffer.from('{}').toString('base64url'), 'a'.repeat(501)])('rejects malformed cursor %s', (cursor) => {
    expect(decodeProjectCursor(cursor, orgA)).toBeNull()
  })
})

