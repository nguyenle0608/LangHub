'use client'

import { Monitor, Moon, Palette, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTheme } from '@/components/theme/ThemeProvider'
import type { ThemeMode } from '@/lib/theme'

const OPTIONS: Array<{ value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export function ThemeHeaderButton() {
  const { mode, setMode, effectiveTheme } = useTheme()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 border border-border px-2 text-xs text-muted-foreground hover:text-foreground"
          title="Change theme"
          aria-label="Change theme"
        >
          <Palette className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-[10px] capitalize text-muted-foreground">
            {mode === 'system' ? effectiveTheme : mode}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 border-border bg-popover p-1 text-popover-foreground" align="end">
        <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Theme</p>
        {OPTIONS.map((option) => {
          const Icon = option.icon
          const selected = mode === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={`flex w-full items-center gap-2.5 rounded px-2 py-2 text-left text-xs transition-colors ${
                selected ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 font-medium">{option.label}</span>
              {selected && <span className="text-[10px] text-muted-foreground">Active</span>}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
