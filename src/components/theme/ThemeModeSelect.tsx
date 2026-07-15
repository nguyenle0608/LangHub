'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import type { ThemeMode } from '@/lib/theme'

const OPTIONS: Array<{ value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export function ThemeModeSelect({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme()

  if (compact) {
    return (
      <label className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-muted-foreground">
        <span>Theme</span>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as ThemeMode)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/50 p-1">
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const selected = mode === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
            }`}
            aria-pressed={selected}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
