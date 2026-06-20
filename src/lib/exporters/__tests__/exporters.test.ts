import { describe, it, expect } from 'vitest'
import { buildNested, exportJSON } from '../json'
import { exportARB } from '../arb'
import { exportCSV } from '../csv'
import { exportYAML } from '../yaml'
import { parseJSON } from '../../parsers/json'
import { parseYAML } from '../../parsers/yaml'

// ── buildNested ─────────────────────────────────────────────────────────────

describe('buildNested', () => {
  it('rebuilds dot.notation into nested objects', () => {
    expect(buildNested({ 'auth.login.title': 'Sign in', 'auth.login.button': 'Go' })).toEqual({
      auth: { login: { title: 'Sign in', button: 'Go' } },
    })
  })

  it('keeps flat keys flat', () => {
    expect(buildNested({ hello: 'Hi' })).toEqual({ hello: 'Hi' })
  })
})

// ── JSON ──────────────────────────────────────────────────────────────────────

describe('exportJSON', () => {
  it('nests by default', () => {
    const out = exportJSON({ 'a.b': 'c' })
    expect(JSON.parse(out)).toEqual({ a: { b: 'c' } })
  })

  it('stays flat when nested=false', () => {
    const out = exportJSON({ 'a.b': 'c' }, false)
    expect(JSON.parse(out)).toEqual({ 'a.b': 'c' })
  })

  it('round-trips with parseJSON', () => {
    const keys = { 'auth.title': 'Sign in', 'home.greeting': 'Hello' }
    const r = parseJSON(exportJSON(keys))
    expect(r.errors).toHaveLength(0)
    expect(r.keys).toEqual(keys)
  })
})

// ── ARB ─────────────────────────────────────────────────────────────────────

describe('exportARB', () => {
  it('includes @@locale and key values', () => {
    const out = JSON.parse(exportARB({ greeting: 'Hello' }, 'en'))
    expect(out['@@locale']).toBe('en')
    expect(out.greeting).toBe('Hello')
  })

  it('emits @key description metadata when provided', () => {
    const out = JSON.parse(exportARB({ greeting: 'Hello' }, 'en', { greeting: 'a salutation' }))
    expect(out['@greeting']).toEqual({ description: 'a salutation' })
  })

  it('omits description metadata when absent', () => {
    const out = JSON.parse(exportARB({ greeting: 'Hello' }, 'en'))
    expect(out['@greeting']).toBeUndefined()
  })
})

// ── CSV ─────────────────────────────────────────────────────────────────────

describe('exportCSV', () => {
  it('writes a header row and one row per key', () => {
    const csv = exportCSV(['a', 'b'], ['en', 'vi'], {
      a: { en: 'A', vi: 'Á' },
      b: { en: 'B', vi: 'Bê' },
    })
    const lines = csv.split('\n')
    expect(lines[0]).toBe('key,en,vi')
    expect(lines[1]).toBe('a,A,Á')
    expect(lines[2]).toBe('b,B,Bê')
  })

  it('fills missing values with empty string', () => {
    const csv = exportCSV(['a'], ['en', 'vi'], { a: { en: 'A' } })
    expect(csv.split('\n')[1]).toBe('a,A,')
  })

  it('escapes commas, quotes and newlines', () => {
    const csv = exportCSV(['k'], ['en'], { k: { en: 'a,b "c"\nd' } })
    expect(csv.split('\n')[0]).toBe('key,en')
    // value gets wrapped in quotes with doubled internal quotes
    expect(csv).toContain('"a,b ""c""\nd"')
  })
})

// ── YAML ──────────────────────────────────────────────────────────────────────

describe('exportYAML', () => {
  it('round-trips with parseYAML', () => {
    const keys = { 'auth.title': 'Sign in', greeting: 'Hello' }
    const r = parseYAML(exportYAML(keys))
    expect(r.errors).toHaveLength(0)
    expect(r.keys).toEqual(keys)
  })
})
