'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  THEME_STORAGE_KEY,
  normalizeThemeMode,
  resolveEffectiveTheme,
  type EffectiveTheme,
  type ThemeMode,
} from '@/lib/theme'

interface ThemeContextValue {
  mode: ThemeMode
  effectiveTheme: EffectiveTheme
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  try {
    return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function applyTheme(mode: ThemeMode, systemPrefersDark: boolean): EffectiveTheme {
  const effectiveTheme = resolveEffectiveTheme(mode, systemPrefersDark)
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.classList.toggle('dark', effectiveTheme === 'dark')
    root.dataset.themeMode = mode
    root.dataset.theme = effectiveTheme
    root.style.colorScheme = effectiveTheme
  }
  return effectiveTheme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)
  const effectiveTheme = resolveEffectiveTheme(mode, systemPrefersDark)

  useEffect(() => {
    const storedMode = getStoredThemeMode()
    const prefersDark = getSystemPrefersDark()
    setModeState(storedMode)
    setSystemPrefersDark(prefersDark)
    applyTheme(storedMode, prefersDark)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches)
      setModeState((currentMode) => {
        applyTheme(currentMode, event.matches)
        return currentMode
      })
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    applyTheme(mode, systemPrefersDark)
  }, [mode, systemPrefersDark])

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode)
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
    applyTheme(nextMode, getSystemPrefersDark())
    setSystemPrefersDark(getSystemPrefersDark())
  }, [])

  const value = useMemo(
    () => ({ mode, effectiveTheme, setMode }),
    [effectiveTheme, mode, setMode]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
