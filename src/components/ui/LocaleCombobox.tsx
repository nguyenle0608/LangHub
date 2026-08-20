'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { LocaleOption } from '@/app/api/locales-list/route'

interface Props {
  value: string
  onChange: (code: string, locale: LocaleOption) => void
  placeholder?: string
  disabled?: boolean
  excludeCodes?: Set<string>
  /**
   * Multi-select: the list stays open and each row toggles, so a project can be
   * set up in one pass instead of reopening the picker for every language.
   */
  multiple?: boolean
  selectedCodes?: Set<string>
}

export function LocaleCombobox({ value, onChange, placeholder = 'Select language…', disabled, excludeCodes, multiple, selectedCodes }: Props) {
  const [open, setOpen] = useState(false)
  const [locales, setLocales] = useState<LocaleOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/locales-list')
      .then((r) => r.json())
      .then((data: LocaleOption[]) => setLocales(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selected = locales.find((l) => l.code === value)

  return (
    // modal: the content is portalled to the body, which puts it outside the
    // Dialog's scroll lock — that lock preventDefault()s wheel events, so the
    // list could only be scrolled by keyboard. modal gives the popover its own.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between bg-background border-input text-foreground hover:bg-accent hover:text-accent-foreground font-normal"
        >
          {loading ? (
            <span className="flex items-center gap-2 text-zinc-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading languages…
            </span>
          ) : multiple && selectedCodes && selectedCodes.size > 0 ? (
            <span className="truncate">
              {selectedCodes.size} language{selectedCodes.size === 1 ? '' : 's'} selected
            </span>
          ) : selected ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="text-base leading-none flex-shrink-0">{selected.flag}</span>
              <span className="truncate">{selected.name}</span>
              {/* A regional entry is already named "English (Canada)"; appending
                  the country again produced "English (Canada) (Canada)". */}
              {!selected.regional && (
                <span className="truncate text-xs text-muted-foreground">({selected.country})</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 bg-popover border-border" align="start">
        <Command className="bg-transparent">
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 flex-shrink-0" />
            <CommandInput
              placeholder="Search language or country…"
              className="text-sm text-foreground placeholder:text-muted-foreground border-0 bg-transparent focus:ring-0 h-9 px-0"
            />
          </div>
          <CommandList className="max-h-64">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No language found.
            </CommandEmpty>
            <CommandGroup>
              {locales.filter((l) => !excludeCodes?.has(l.code)).map((locale) => (
                <CommandItem
                  key={locale.code}
                  value={`${locale.name} ${locale.country} ${locale.code}`}
                  onSelect={() => {
                    onChange(locale.code, locale)
                    if (!multiple) setOpen(false)
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-popover-foreground aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent"
                >
                  <span className="text-base w-5 text-center leading-none">{locale.flag}</span>
                  <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
                    <span className="truncate text-sm">{locale.name}</span>
                    {!locale.regional && (
                      <span className="truncate text-xs text-muted-foreground">{locale.country}</span>
                    )}
                  </div>
                  <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">{locale.code}</span>
                  {(multiple ? selectedCodes?.has(locale.code) : value === locale.code) && (
                    <Check className="h-3.5 w-3.5 flex-shrink-0 text-blue-500 dark:text-blue-400" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
