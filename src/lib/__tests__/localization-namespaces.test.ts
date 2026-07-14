import { describe, expect, it } from 'vitest'
import {
  deriveNamespaceFromFilename,
  detectTransformedKeyCollisions,
  prefixKeysWithNamespace,
  sanitizeNamespaceSegment,
  splitKeysByNamespace,
} from '../localization-namespaces'

describe('localization namespace utilities', () => {
  it('derives sanitized namespaces from filenames', () => {
    expect(deriveNamespaceFromFilename('authen.json')).toBe('authen')
    expect(deriveNamespaceFromFilename('User Profile.json')).toBe('user_profile')
    expect(deriveNamespaceFromFilename('/tmp/auth-screen.JSON')).toBe('auth_screen')
  })

  it('sanitizes namespace segments', () => {
    expect(sanitizeNamespaceSegment('  Auth--Screen  ')).toBe('auth_screen')
    expect(sanitizeNamespaceSegment('@@@')).toBe('')
  })

  it('prefixes parsed JSON keys with a namespace', () => {
    expect(prefixKeysWithNamespace({ keyA: 'A', 'login.title': 'Sign in' }, 'authen')).toEqual({
      'authen.keyA': 'A',
      'authen.login.title': 'Sign in',
    })
  })

  it('detects collisions after namespace transformation', () => {
    expect(detectTransformedKeyCollisions([
      { filename: 'authen.json', namespace: 'authen', keys: { keyA: 'A' } },
      { filename: 'authen-copy.json', namespace: 'authen', keys: { keyA: 'B' } },
      { filename: 'home.json', namespace: 'home', keys: { keyA: 'C' } },
    ])).toEqual(['authen.keyA'])
  })

  it('splits flat dot-notation keys by first namespace segment', () => {
    expect(splitKeysByNamespace({
      'authen.login.title': 'Sign in',
      'authen.logout': 'Sign out',
      'home.title': 'Home',
      appName: 'LangHub',
    })).toEqual([
      {
        namespace: '_root',
        filename: '_root.json',
        keys: { appName: 'LangHub' },
      },
      {
        namespace: 'authen',
        filename: 'authen.json',
        keys: { 'login.title': 'Sign in', logout: 'Sign out' },
      },
      {
        namespace: 'home',
        filename: 'home.json',
        keys: { title: 'Home' },
      },
    ])
  })
})
