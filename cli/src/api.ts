import { createHash } from 'node:crypto'
import type { Config } from './config.js'
import { parseFile, serialize } from './sync.js'
import type { Flat } from './keys.js'

/**
 * What the export should include.
 *
 * `approved` is right for pulling: a pending translation is someone's draft and
 * does not belong in a shipped file. It is wrong for pushing, where the
 * question is what LangHub already holds — a pending value filtered out here
 * would read as "LangHub has nothing for this key", and the push would
 * overwrite that draft without ever mentioning it.
 */
type Filter = 'approved' | 'all'

/**
 * One locale per request. The export endpoint returns plain JSON for a single
 * locale and a zip for several, and unpacking a zip to get back what we already
 * asked for one at a time buys nothing.
 */
export async function fetchLocale(
  config: Config,
  localeCode: string,
  token: string,
  filter: Filter = 'approved'
): Promise<Flat> {
  const query = new URLSearchParams({
    locales: localeCode,
    branch: config.branch,
    format: 'json',
    nested: 'false',
    filter,
    // An omitted key falls back; a key mapped to "" does not.
    includeEmpty: 'false',
  })
  const response = await send(
    config,
    `/api/v1/projects/${config.projectId}/export?${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
    localeCode
  )
  return parseFile(await response.text())
}

export interface PushResult {
  created: number
  updated: number
  unchanged: number
  snapshotId?: string
}

/**
 * Send a locale's values to LangHub, as an import of exactly the keys given.
 *
 * Import is an upsert: a key the file does not mention is not touched. That is
 * what lets a reviewed subset be pushed — the keys someone declined stay as
 * they are in LangHub rather than being deleted for their absence.
 *
 * The idempotency key is derived from the content, so a retry after a timeout
 * cannot apply the same values a second time, and two people pushing the same
 * file resolve to one import rather than two.
 */
export async function pushLocale(
  config: Config,
  localeCode: string,
  token: string,
  entries: Flat
): Promise<PushResult> {
  const body = serialize(entries)
  const form = new FormData()
  form.set('file', new Blob([body], { type: 'application/json' }), `${localeCode}.json`)
  form.set('locale', localeCode)
  form.set('branch', config.branch)
  form.set('format', 'json')

  const fingerprint = createHash('sha256')
    .update(`${config.projectId}:${config.branch}:${localeCode}:${body}`)
    .digest('hex')

  const response = await send(
    config,
    `/api/v1/projects/${config.projectId}/import`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Must match the server's pattern: 8-200 of [A-Za-z0-9._:-].
        'Idempotency-Key': `langhub-cli.${fingerprint.slice(0, 40)}`,
      },
      body: form,
    },
    localeCode
  )
  const json = await response.json() as { data?: PushResult } | PushResult
  const result = ('data' in json ? json.data : json) as PushResult | undefined
  return {
    created: result?.created ?? 0,
    updated: result?.updated ?? 0,
    unchanged: result?.unchanged ?? 0,
    snapshotId: result?.snapshotId,
  }
}

async function send(
  config: Config,
  path: string,
  init: RequestInit,
  localeCode: string
): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${config.apiBase}${path}`, init)
  } catch (error) {
    throw new Error(`Could not reach ${config.apiBase}: ${(error as Error).message}`)
  }
  if (!response.ok) {
    const body = (await response.text().catch(() => '')).slice(0, 300)
    // Naming the host is the whole diagnosis when the URL is the problem: a
    // bare "404" reads as a missing project, and sends people to check the
    // project id rather than the address they are checking it against.
    throw new Error(
      `${config.apiBase} returned ${response.status} for ${localeCode}` +
      `${body ? `: ${body}` : ' with an empty body — is this a LangHub deployment?'}`
    )
  }
  return response
}

export interface RemoteLocale {
  code: string
  name: string
  isBase: boolean
}

/** Every locale the project has, so a caller can see what there is to ask for. */
export async function fetchLocales(config: Config, token: string): Promise<RemoteLocale[]> {
  const response = await send(
    config,
    `/api/v1/projects/${config.projectId}/locales`,
    { headers: { Authorization: `Bearer ${token}` } },
    'locales'
  )
  const json = await response.json() as { data?: RemoteLocale[] }
  return json.data ?? []
}
