import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * langhub.json, committed alongside the code it feeds.
 *
 * Everything here is safe to read: project id, branch, which file each locale
 * lands in. The token is not part of it and comes from the environment, so a
 * repo can carry its sync configuration without carrying a credential.
 */
export interface Config {
  projectId: string
  branch: string
  format: Format
  output: string
  /** LangHub locale code -> the basename this repo reads it from. */
  locales: Record<string, string>
  /** Where LangHub runs. Always explicit — see requireApiBase. */
  apiBase: string
}

/**
 * JSON is what the CLI writes today. The other export formats LangHub produces
 * are listed so asking for one gets an answer rather than a schema error, and
 * so the reason is visible: each has file-level structure — ARB's `@key`
 * metadata, XML escaping, .strings quoting — that a merge has to preserve, and
 * preserving it correctly is more than a format flag.
 */
const FORMATS = ['json'] as const
const PLANNED = ['arb', 'android', 'ios', 'yaml', 'csv', 'tsv']
export type Format = typeof FORMATS[number]

const CONFIG_FILE = 'langhub.json'

export function loadConfig(cwd: string): Config {
  const path = resolve(cwd, CONFIG_FILE)
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`No ${CONFIG_FILE} here. Run \`langhub init\` to write one.`)
    }
    throw new Error(`${CONFIG_FILE} is not valid JSON: ${(error as Error).message}`)
  }

  const format = typeof raw.format === 'string' ? raw.format : 'json'
  if (!FORMATS.includes(format as Format)) {
    throw new Error(PLANNED.includes(format)
      ? `format "${format}" is coming soon — the CLI writes JSON today.`
      : `Unknown format "${format}". Supported: ${FORMATS.join(', ')}.`)
  }

  const locales = raw.locales
  if (!locales || typeof locales !== 'object' || Array.isArray(locales)) {
    throw new Error(`${CONFIG_FILE}: "locales" must be an object of langHubCode -> filename`)
  }
  if (Object.keys(locales).length === 0) {
    throw new Error(`${CONFIG_FILE}: "locales" is empty — nothing to sync`)
  }

  return {
    projectId: requireString(raw, 'projectId'),
    branch: typeof raw.branch === 'string' ? raw.branch : 'main',
    format: format as Format,
    output: typeof raw.output === 'string' ? raw.output : '.',
    locales: locales as Record<string, string>,
    apiBase: requireApiBase(typeof raw.apiBase === 'string' ? raw.apiBase : undefined),
  }
}

/**
 * Where to send the token. There is no default, on purpose.
 *
 * This tool puts a credential in an Authorization header, so the hostname it
 * talks to has to be one someone chose. An earlier version defaulted to a
 * plausible-looking domain; a repository that had not set this sent its bearer
 * token there, to a host nobody involved controlled. A guessed hostname is a
 * guess about who receives the secret, and there is no safe way to guess that.
 */
function requireApiBase(fromConfig: string | undefined): string {
  const value = process.env.LANGHUB_API_BASE ?? fromConfig
  if (!value) {
    throw new Error(
      'No LangHub URL configured. Set LANGHUB_API_BASE in .env.langhub, or\n' +
      '"apiBase" in langhub.json — for example https://your-langhub.example.com\n' +
      'or http://localhost:3000. The CLI does not guess: it sends your token to\n' +
      'whatever host it is told.'
    )
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`LangHub URL is not a valid URL: ${value}`)
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    // A bearer token over plaintext is readable by anything on the path.
    // localhost is exempt because the request never leaves the machine.
    throw new Error(`LangHub URL must use https (or localhost): ${value}`)
  }
  return value.replace(/\/+$/, '')
}

function requireString(raw: Record<string, unknown>, field: string): string {
  const value = raw[field]
  if (typeof value !== 'string' || !value) {
    throw new Error(`${CONFIG_FILE}: "${field}" is required`)
  }
  return value
}

export function requireToken(): string {
  const token = process.env.LANGHUB_TOKEN
  if (!token) {
    throw new Error(
      'LANGHUB_TOKEN is not set. Create a read-scoped token in LangHub under\n' +
      'Organization Settings -> API Tokens — it is shown once — and put it in\n' +
      '.env.langhub, or set it in the environment.'
    )
  }
  return token
}
