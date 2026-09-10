import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const ENV_FILE = '.env.langhub'

/**
 * Read `.env.langhub` into the environment, if it is there.
 *
 * A variable already set wins over the file. That order matters on CI, where
 * the token comes from a secrets store: a stale file committed by accident, or
 * left behind from local work, must not quietly override the real credential
 * with an old one — the failure would be an authentication error nobody can
 * explain from the logs.
 *
 * Deliberately small. This reads `KEY=value`, strips one layer of quotes, and
 * ignores blank lines and comments. Anything more — expansion, multi-line
 * values — belongs to a real dotenv library, and a credential file that needs
 * those is a credential file doing too much.
 */
export function loadEnvFile(cwd: string): boolean {
  let contents: string
  try {
    contents = readFileSync(resolve(cwd, ENV_FILE), 'utf8')
  } catch {
    return false
  }
  for (const line of contents.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match || line.trimStart().startsWith('#')) continue
    const key = match[1]!
    if (process.env[key]) continue
    const value = match[2]!.trim().replace(/^(['"])(.*)\1$/, '$2')
    // An empty assignment is the placeholder `init` writes, not a value. Setting
    // it would shadow a real one further down the file — and would turn "you
    // have not filled this in yet" into an authentication failure.
    if (value) process.env[key] = value
  }
  return true
}
