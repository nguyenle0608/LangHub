import { createAdminClient } from '../admin'

export { displayNameFromEmail } from '@/lib/display-name'

/**
 * Resolve user ids to emails.
 *
 * There is no `profiles` table mirroring `auth.users`, and PostgREST cannot
 * join the auth schema, so the only way to put a name next to a comment or a
 * history entry is the admin listUsers API — the same route the members list
 * already takes.
 *
 * That call fetches every user in the project, and the same few ids recur on
 * every key the editor opens, so the result is cached briefly. The cache is
 * per server instance and best-effort: a miss just costs one more call.
 */
const CACHE_TTL_MS = 60_000
const PER_PAGE = 1000

let cache: { loadedAt: number; emails: Map<string, string> } | null = null

async function loadEmails(): Promise<Map<string, string>> {
  const fresh = cache && Date.now() - cache.loadedAt < CACHE_TTL_MS
  if (fresh) return cache!.emails

  const emails = new Map<string, string>()
  try {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.listUsers({ perPage: PER_PAGE })
    for (const user of data?.users ?? []) {
      if (user.email) emails.set(user.id, user.email)
    }
    cache = { loadedAt: Date.now(), emails }
  } catch {
    // Never let a failed lookup break the thing being displayed — the caller
    // falls back to "Unknown". Not cached, so the next call retries.
    return cache?.emails ?? emails
  }
  return emails
}

/** Map of user id → email, for the ids that resolved. */
export async function resolveUserEmails(
  userIds: Array<string | null | undefined>
): Promise<Record<string, string>> {
  const wanted = new Set(userIds.filter((id): id is string => !!id))
  if (wanted.size === 0) return {}

  const emails = await loadEmails()
  const out: Record<string, string> = {}
  for (const id of Array.from(wanted)) {
    const email = emails.get(id)
    if (email) out[id] = email
  }
  return out
}
