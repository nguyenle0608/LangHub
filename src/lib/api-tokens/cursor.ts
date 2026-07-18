import { z } from 'zod'

const ProjectCursorSchema = z.object({ id: z.string().uuid(), orgId: z.string().uuid() }).strict()

export function encodeProjectCursor(value: { id: string; orgId: string }): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

export function decodeProjectCursor(cursor: string, expectedOrgId: string): { id: string } | null {
  try {
    if (cursor.length > 500) return null
    const parsed = ProjectCursorSchema.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')))
    return parsed.success && parsed.data.orgId === expectedOrgId ? { id: parsed.data.id } : null
  } catch {
    return null
  }
}

