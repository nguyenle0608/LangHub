import { describe, it, expect } from 'vitest'
import { parseJSON } from '../json'
import { parseARB } from '../arb'
import { parseCSV } from '../csv'
import { parseYAML } from '../yaml'

// ── JSON ──────────────────────────────────────────────────────────────────────

describe('parseJSON', () => {
  it('flattens nested object', () => {
    const r = parseJSON(JSON.stringify({ auth: { login: { title: 'Sign in', button: 'Log in' } } }))
    expect(r.errors).toHaveLength(0)
    expect(r.keys['auth.login.title']).toBe('Sign in')
    expect(r.keys['auth.login.button']).toBe('Log in')
  })

  it('handles flat object', () => {
    const r = parseJSON(JSON.stringify({ greeting: 'Hello', farewell: 'Goodbye' }))
    expect(r.errors).toHaveLength(0)
    expect(r.keys['greeting']).toBe('Hello')
    expect(r.keys['farewell']).toBe('Goodbye')
  })

  it('returns error on invalid JSON', () => {
    const r = parseJSON('{ not valid json }')
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.keys).toEqual({})
  })
})

// ── ARB ───────────────────────────────────────────────────────────────────────

describe('parseARB', () => {
  it('extracts locale from @@locale', () => {
    const r = parseARB(JSON.stringify({ '@@locale': 'vi', hello: 'Xin chào', '@hello': { description: 'greeting' } }))
    expect(r.errors).toHaveLength(0)
    expect(r.locale).toBe('vi')
    expect(r.keys['hello']).toBe('Xin chào')
  })

  it('skips @ metadata keys', () => {
    const r = parseARB(JSON.stringify({ '@@locale': 'en', '@@last_modified': '2024', myKey: 'val', '@myKey': {} }))
    expect(r.keys['myKey']).toBe('val')
    expect(r.keys['@@last_modified']).toBeUndefined()
    expect(r.keys['@myKey']).toBeUndefined()
  })

  it('returns error on invalid JSON', () => {
    const r = parseARB('not json')
    expect(r.errors.length).toBeGreaterThan(0)
  })
})

// ── CSV ───────────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  it('returns one result per locale column', () => {
    const csv = 'key,en,vi\nhello,Hello,Xin chào\ngoodbye,Goodbye,Tạm biệt'
    const results = parseCSV(csv)
    expect(results).toHaveLength(2)
    expect(results[0]?.locale).toBe('en')
    expect(results[0]?.keys['hello']).toBe('Hello')
    expect(results[1]?.locale).toBe('vi')
    expect(results[1]?.keys['hello']).toBe('Xin chào')
  })

  it('errors if first column is not "key"', () => {
    const csv = 'name,en\nhello,Hello'
    const results = parseCSV(csv)
    expect(results[0]?.errors.length).toBeGreaterThan(0)
  })

  it('skips rows with empty keys', () => {
    const csv = 'key,en\nhello,Hello\n,Missing'
    const results = parseCSV(csv)
    expect(results[0]?.keys['hello']).toBe('Hello')
    expect(Object.keys(results[0]?.keys ?? {})).toHaveLength(1)
  })
})

// ── YAML ──────────────────────────────────────────────────────────────────────

describe('parseYAML', () => {
  it('flattens nested YAML', () => {
    const r = parseYAML('auth:\n  login:\n    title: Sign in\n')
    expect(r.errors).toHaveLength(0)
    expect(r.keys['auth.login.title']).toBe('Sign in')
  })

  it('handles flat YAML', () => {
    const r = parseYAML('greeting: Hello\nfarewell: Goodbye\n')
    expect(r.keys['greeting']).toBe('Hello')
    expect(r.keys['farewell']).toBe('Goodbye')
  })

  it('returns error on invalid YAML', () => {
    const r = parseYAML('key: [unclosed')
    expect(r.errors.length).toBeGreaterThan(0)
  })
})
