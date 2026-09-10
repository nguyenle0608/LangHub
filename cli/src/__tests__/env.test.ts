import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ENV_FILE, loadEnvFile } from '../env'

let dir: string
const KEYS = ['LANGHUB_TOKEN', 'LANGHUB_API_BASE', 'LANGHUB_BRANCH']

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'langhub-env-'))
  for (const key of KEYS) delete process.env[key]
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  for (const key of KEYS) delete process.env[key]
})

const write = (contents: string) => writeFileSync(join(dir, ENV_FILE), contents)

describe('loadEnvFile', () => {
  it('says so when there is no file, and changes nothing', () => {
    expect(loadEnvFile(dir)).toBe(false)
    expect(process.env.LANGHUB_TOKEN).toBeUndefined()
  })

  it('reads a value, ignoring comments and blank lines', () => {
    write('# a comment\n\nLANGHUB_TOKEN=lh_abc\n')
    expect(loadEnvFile(dir)).toBe(true)
    expect(process.env.LANGHUB_TOKEN).toBe('lh_abc')
  })

  it('lets the real environment win, so CI secrets are not overridden', () => {
    process.env.LANGHUB_TOKEN = 'lh_from_ci'
    write('LANGHUB_TOKEN=lh_stale_local\n')
    loadEnvFile(dir)
    expect(process.env.LANGHUB_TOKEN).toBe('lh_from_ci')
  })

  it('treats the empty placeholder init writes as unfilled, not as a value', () => {
    // Otherwise "you have not filled this in yet" arrives as an authentication
    // failure, and the line below it never applies.
    write('LANGHUB_TOKEN=\nLANGHUB_TOKEN=lh_real\n')
    loadEnvFile(dir)
    expect(process.env.LANGHUB_TOKEN).toBe('lh_real')
  })

  it('strips one layer of quotes and surrounding space', () => {
    write('LANGHUB_API_BASE = "http://localhost:3000" \nLANGHUB_BRANCH=\'main\'\n')
    loadEnvFile(dir)
    expect(process.env.LANGHUB_API_BASE).toBe('http://localhost:3000')
    expect(process.env.LANGHUB_BRANCH).toBe('main')
  })

  it('ignores a line that is not an assignment', () => {
    write('this is not a variable\nLANGHUB_TOKEN=lh_ok\n')
    loadEnvFile(dir)
    expect(process.env.LANGHUB_TOKEN).toBe('lh_ok')
  })
})
