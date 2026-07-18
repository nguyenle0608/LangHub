import { createHash, randomBytes } from 'crypto'

const TOKEN_PREFIX = 'lh_'
const TOKEN_BYTES = 32
const TOKEN_BODY_LENGTH = 43
const TOKEN_PATTERN = new RegExp(`^${TOKEN_PREFIX}[A-Za-z0-9_-]{${TOKEN_BODY_LENGTH}}$`)

export function generateApiToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`
}

export function isValidApiToken(token: string): boolean {
  return TOKEN_PATTERN.test(token)
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Non-secret identifier suitable for token lists and support messages. */
export function apiTokenDisplayPrefix(token: string): string {
  if (!isValidApiToken(token)) throw new Error('Invalid API token')
  return `${token.slice(0, 10)}…`
}

