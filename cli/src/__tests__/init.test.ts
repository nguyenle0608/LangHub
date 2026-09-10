import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CLI = join(process.cwd(), 'cli/dist/index.js')
let dir: string

const run = () => execFileSync('node', [CLI, 'init'], { cwd: dir, encoding: 'utf8' })
const read = (name: string) => readFileSync(join(dir, name), 'utf8')

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'langhub-init-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('langhub init', () => {
  it('sets up all three pieces in an empty repository', () => {
    const output = run()
    expect(output).toContain('Wrote langhub.json')
    expect(output).toContain('Wrote .env.langhub')
    expect(read('.gitignore')).toContain('.env.langhub')
  })

  it('finishes a half-configured repository instead of refusing', () => {
    // The case that motivated this: langhub.json committed by hand, so the run
    // that would have created the credential file and the ignore rule bailed
    // out at the first line and left the repository able to commit a token.
    writeFileSync(join(dir, 'langhub.json'), '{}')
    const output = run()

    expect(output).toContain('langhub.json already exists')
    expect(output).toContain('Wrote .env.langhub')
    expect(read('.gitignore')).toContain('.env.langhub')
    expect(read('langhub.json')).toBe('{}')
  })

  it('can be run again without changing anything', () => {
    run()
    const before = [read('langhub.json'), read('.env.langhub'), read('.gitignore')]
    const output = run()

    expect([read('langhub.json'), read('.env.langhub'), read('.gitignore')]).toEqual(before)
    expect(output).toContain('already exists — left alone')
  })

  it('never overwrites a token file that is already there', () => {
    run()
    writeFileSync(join(dir, '.env.langhub'), 'LANGHUB_TOKEN=lh_mine\n')
    run()
    expect(read('.env.langhub')).toBe('LANGHUB_TOKEN=lh_mine\n')
  })

  it('adds no rule when git already ignores the file', () => {
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.env*\n')
    const output = run()

    expect(output).toContain('already covered by .gitignore')
    expect(read('.gitignore')).toBe('node_modules/\n.env*\n')
  })

  it('says so outside a repository rather than pretending the file is safe', () => {
    rmSync(join(dir, '.git'), { recursive: true, force: true })
    expect(run()).toContain('Not a git repository')
    expect(existsSync(join(dir, '.gitignore'))).toBe(false)
  })
})
