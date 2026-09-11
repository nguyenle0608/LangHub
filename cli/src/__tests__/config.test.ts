import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../config'

let dir: string
const base = {
  projectId: '4eb25308-4455-4fdc-881a-a9823bb6586b',
  locales: { 'en-US': 'en-US' },
}
const write = (config: Record<string, unknown>) =>
  writeFileSync(join(dir, 'langhub.json'), JSON.stringify(config))

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'langhub-config-'))
  delete process.env.LANGHUB_API_BASE
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  delete process.env.LANGHUB_API_BASE
})

describe('apiBase', () => {
  it('refuses to guess a host to send the token to', () => {
    // An earlier version defaulted to a plausible domain nobody controlled, and
    // an unconfigured repository sent its bearer token there.
    write(base)
    expect(() => loadConfig(dir)).toThrow(/No LangHub URL configured/)
  })

  it('rejects plaintext http, which exposes the bearer token in transit', () => {
    write({ ...base, apiBase: 'http://langhub.example.com' })
    expect(() => loadConfig(dir)).toThrow(/must use https/)
  })

  it('allows http on localhost, where the request never leaves the machine', () => {
    write({ ...base, apiBase: 'http://localhost:3000' })
    expect(loadConfig(dir).apiBase).toBe('http://localhost:3000')
  })

  it('takes the environment over the config file', () => {
    process.env.LANGHUB_API_BASE = 'https://from-env.example.com'
    write({ ...base, apiBase: 'https://from-file.example.com' })
    expect(loadConfig(dir).apiBase).toBe('https://from-env.example.com')
  })

  it('trims a trailing slash, so paths are not built with a double one', () => {
    write({ ...base, apiBase: 'https://langhub.example.com/' })
    expect(loadConfig(dir).apiBase).toBe('https://langhub.example.com')
  })

  it('rejects something that is not a URL at all', () => {
    write({ ...base, apiBase: 'langhub.example.com' })
    expect(() => loadConfig(dir)).toThrow(/not a valid URL/)
  })
})

describe('other guards', () => {
  it('names a format that is planned but not written yet', () => {
    write({ ...base, apiBase: 'https://x.example.com', format: 'arb' })
    expect(() => loadConfig(dir)).toThrow(/coming soon/)
  })

  it('refuses an empty locale map rather than reporting "no change"', () => {
    write({ projectId: base.projectId, apiBase: 'https://x.example.com', locales: {} })
    expect(() => loadConfig(dir)).toThrow(/nothing to sync/)
  })
})
