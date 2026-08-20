'use client'

import { useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  value: string[]
  /**
   * Persist the new list. Return a promise to get per-tag pending feedback:
   * the chip shows a spinner where its remove button is until it settles.
   * Resolving `false` counts as a failure, matching patchMeta's contract.
   * A synchronous handler (local state, nothing to await) skips all of that.
   */
  onChange: (next: string[]) => boolean | void | Promise<boolean | void>
  /** Every tag already used in the project, so the same one isn't spelled two ways. */
  suggestions?: string[]
  disabled?: boolean
  placeholder?: string
  className?: string
}

const MAX_SUGGESTIONS = 8

type Pending = 'adding' | 'removing'

export function TagInput({ value, onChange, suggestions = [], disabled, placeholder = 'Add tag…', className }: Props) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [pending, setPending] = useState<Record<string, Pending>>({})
  /**
   * Tags accepted locally but not yet confirmed by the server. They render
   * immediately so typing feels instant. On success the parent has already
   * pushed the tag into `value`, so dropping it here changes nothing; on
   * failure it is in neither list and the chip disappears — which is the
   * signal that the add did not stick.
   */
  const [optimistic, setOptimistic] = useState<string[]>([])

  const normalised = draft.trim().toLowerCase()
  const shown = useMemo(
    () => [...value, ...optimistic.filter((t) => !value.includes(t))],
    [value, optimistic]
  )

  const matches = useMemo(() => {
    const owned = new Set(shown)
    return suggestions
      .filter((tag) => !owned.has(tag) && (normalised === '' || tag.includes(normalised)))
      .slice(0, MAX_SUGGESTIONS)
  }, [suggestions, shown, normalised])

  const settle = (tag: string) =>
    setPending((prev) => {
      const next = { ...prev }
      delete next[tag]
      return next
    })

  const commit = (next: string[], tag: string, mode: Pending) => {
    const result = onChange(next)
    if (!(result instanceof Promise)) return

    setPending((prev) => ({ ...prev, [tag]: mode }))
    void result
      .catch(() => false)
      .finally(() => {
        settle(tag)
        if (mode === 'adding') setOptimistic((prev) => prev.filter((t) => t !== tag))
      })
  }

  const add = (tag: string) => {
    const clean = tag.trim().toLowerCase()
    setDraft('')
    if (!clean || shown.includes(clean)) return
    setOptimistic((prev) => [...prev, clean])
    commit([...value, clean], clean, 'adding')
  }

  const remove = (tag: string) => {
    if (pending[tag]) return
    commit(value.filter((t) => t !== tag), tag, 'removing')
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {shown.map((tag) => {
            const state = pending[tag]
            return (
              <span
                key={tag}
                className={cn(
                  'inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-foreground transition-opacity',
                  state && 'opacity-60'
                )}
              >
                {tag}
                {!disabled && (
                  state
                    ? <Loader2 className="h-2 w-2 animate-spin" aria-label={state === 'adding' ? `Saving tag ${tag}` : `Removing tag ${tag}`} />
                    : (
                      <button type="button" onClick={() => remove(tag)} aria-label={`Remove tag ${tag}`}>
                        <X className="h-2 w-2" />
                      </button>
                    )
                )}
              </span>
            )
          })}
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
              {normalised !== '' && !suggestions.includes(normalised) && (
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
