'use client'

import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'

export type KeyListTone = 'new' | 'fill' | 'dupe'

const TONE_CLASS: Record<KeyListTone, string> = {
  new: 'bg-emerald-500/5 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400',
  fill: 'bg-blue-500/5 border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400',
  dupe: 'bg-amber-500/5 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400',
}

// Row height is fixed so the virtualizer needs no measurement pass; rows are
// single-line and truncated.
const ROW_HEIGHT = 33

interface Props {
  title: string
  keys: string[]
  tone: KeyListTone
  parsedKeys?: Record<string, string>
  selected: Set<string>
  expanded: boolean
  onToggle: () => void
  onToggleKey: (dotKey: string) => void
  /** Applies to exactly the keys handed over — the filtered subset when a search is active. */
  onSetAll: (keys: string[], checked: boolean) => void
}

export function SelectableKeyList({
  title,
  keys,
  tone,
  parsedKeys,
  selected,
  expanded,
  onToggle,
  onToggleKey,
  onSetAll,
}: Props) {
  const [filter, setFilter] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const needle = filter.trim().toLowerCase()
  const visibleKeys = useMemo(() => {
    if (!needle) return keys
    return keys.filter((dotKey) =>
      dotKey.toLowerCase().includes(needle)
      || (parsedKeys?.[dotKey] ?? '').toLowerCase().includes(needle))
  }, [keys, parsedKeys, needle])

  // Every row is rendered through the virtualizer, so there is no cap on how
  // many keys can be ticked individually.
  const virtualizer = useVirtualizer({
    count: visibleKeys.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => visibleKeys[index] ?? `missing:${index}`,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  if (keys.length === 0) return null

  const selectedCount = keys.reduce((sum, dotKey) => sum + (selected.has(dotKey) ? 1 : 0), 0)
  const isFiltered = needle.length > 0
  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs border-b hover:bg-card/30 ${TONE_CLASS[tone]}`}
      >
        <span>
          <span className="font-medium">{title}</span>
          <span className="ml-1 text-muted-foreground">
            ({selectedCount} of {keys.length} selected)
          </span>
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <>
          <div className="flex items-center gap-2 px-3 py-2 bg-card/60 border-b border-border/60">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter keys or values…"
                className="w-full bg-background border border-border rounded pl-7 pr-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {isFiltered ? `${visibleKeys.length} match${visibleKeys.length === 1 ? '' : 'es'}` : `${keys.length} keys`}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                onClick={() => onSetAll(visibleKeys, true)}
              >
                {isFiltered ? 'All matching' : 'All'}
              </button>
              <span className="text-border">·</span>
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => onSetAll(visibleKeys, false)}
              >
                {isFiltered ? 'None matching' : 'None'}
              </button>
            </div>
          </div>

          {visibleKeys.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-muted-foreground">
              No key matches “{filter.trim()}”
            </div>
          ) : (
            <div ref={scrollRef} className="max-h-72 overflow-y-auto">
              <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {virtualItems.length > 0 && (
                  <div style={{ transform: `translateY(${virtualItems[0]!.start}px)` }}>
                    {virtualItems.map((item) => {
                      const dotKey = visibleKeys[item.index]!
                      const isSelected = selected.has(dotKey)
                      return (
                        <label
                          key={dotKey}
                          style={{ height: ROW_HEIGHT }}
                          className="flex items-center gap-3 px-3 border-b border-border/50 hover:bg-card/40 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleKey(dotKey)}
                            className="rounded border-border flex-shrink-0"
                          />
                          <span className={[
                            'text-[11px] font-mono flex-1 min-w-0 truncate',
                            isSelected ? 'text-foreground' : 'text-muted-foreground line-through',
                          ].join(' ')}>
                            {dotKey}
                          </span>
                          <span className={[
                            'text-[11px] text-muted-foreground flex-1 min-w-0 truncate',
                            isSelected ? '' : 'line-through',
                          ].join(' ')}>
                            {parsedKeys?.[dotKey] ?? ''}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
