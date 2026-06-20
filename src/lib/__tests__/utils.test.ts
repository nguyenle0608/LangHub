import { describe, it, expect } from 'vitest'
import { localeFlag } from '../locale-flag'
import { cn } from '../utils'

describe('localeFlag', () => {
  it('maps a known locale to its regional-indicator flag emoji', () => {
    expect(localeFlag('vi')).toBe('🇻🇳')
    expect(localeFlag('en')).toBe('🇺🇸') // en → US
    expect(localeFlag('ja')).toBe('🇯🇵')
  })

  it('falls back to a globe for unknown locales', () => {
    expect(localeFlag('xx')).toBe('🌐')
    expect(localeFlag('')).toBe('🌐')
  })
})

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('lets later Tailwind utilities win conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
