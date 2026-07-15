import { describe, expect, it } from 'vitest'
import {
  THEME_STORAGE_KEY,
  isThemeMode,
  normalizeThemeMode,
  resolveEffectiveTheme,
  themeInitScript,
} from '@/lib/theme'

describe('theme helpers', () => {
  it('validates supported theme modes', () => {
    expect(isThemeMode('system')).toBe(true)
    expect(isThemeMode('light')).toBe(true)
    expect(isThemeMode('dark')).toBe(true)
    expect(isThemeMode('auto')).toBe(false)
    expect(isThemeMode(null)).toBe(false)
  })

  it('normalizes unknown stored values to system', () => {
    expect(normalizeThemeMode('light')).toBe('light')
    expect(normalizeThemeMode('dark')).toBe('dark')
    expect(normalizeThemeMode('system')).toBe('system')
    expect(normalizeThemeMode('invalid')).toBe('system')
    expect(normalizeThemeMode(undefined)).toBe('system')
  })

  it('resolves system mode using the system preference', () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark')
    expect(resolveEffectiveTheme('system', false)).toBe('light')
    expect(resolveEffectiveTheme('light', true)).toBe('light')
    expect(resolveEffectiveTheme('dark', false)).toBe('dark')
  })

  it('uses the shared storage key in the early init script', () => {
    expect(themeInitScript()).toContain(THEME_STORAGE_KEY)
  })
})
