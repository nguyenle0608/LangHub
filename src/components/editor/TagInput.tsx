'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  value: string[]
  onChange: (next: string[]) => void
  /** Every tag already used in the project, so the same one isn't spelled two ways. */
  suggestions?: string[]
  disabled?: boolean
  placeholder?: string
  className?: string
}

const MAX_SUGGESTIONS = 8

/**
 * Tag entry with completion over the project's existing tags.
 *
 * Both places that edit tags used to carry their own copy of this — an input
 * that only ever created new tags, with no way to see what already existed.
 * Free-text tagging without completion quietly splits into `mobile`/`Mobile`/
 * `mobiles`, which makes filtering by them useless.
 */
export function TagInput({ value, onChange, suggestions = [], disabled, placeholder = 'Add tag…', className }: Props) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  const normalised = draft.trim().toLowerCase()

  const matches = useMemo(() => {
    const owned = new Set(value)
    return suggestions
      .filter((tag) => !owned.has(tag) && (normalised === '' || tag.includes(normalised)))
      .slice(0, MAX_SUGGESTIONS)
  }, [suggestions, value, normalised])

  const add = (tag: string) => {
    const clean = tag.trim().toLowerCase()
    if (!clean || value.includes(clean)) { setDraft(''); return }
    onChange([...value, clean])
    setDraft('')
  }

  const exactExists = suggestions.includes(normalised)

  return (
    <div className={cn('space-y-1.5', className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
              {tag}
              {!disabled && (
                <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove tag ${tag}`}>
                  <X className="h-2 w-2" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="relative">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFocused(true)}
            // Blur is deferred so a click on a suggestion registers first.
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); add(draft) }
              if (e.key === 'Escape') { setDraft(''); setFocused(false) }
            }}
            placeholder={placeholder}
            className="h-6 border-border bg-background px-2 text-[11px]"
          />

          {focused && matches.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
              {normalised !== '' && !exactExists && (
                <p className="px-2 pb-1 text-[10px] text-muted-foreground">Existing tags</p>
              )}
              {matches.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(tag)}
                  className="block w-full px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
