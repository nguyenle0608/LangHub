'use client'

import { useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string | null
  status?: string | null
  charLimit: number | null
  isEditing: boolean
  isSaving: boolean
  editValue: string
  presenceColor?: string
  isReadonly?: boolean
  onEditValueChange: (v: string) => void
  onFocused: () => void
  onBlurred: () => void
  onSave: () => void
  onCancel: () => void
}

const STATUS_DOT: Record<string, string> = {
  approved: 'bg-emerald-500',
  reviewed: 'bg-blue-500',
  pending: 'bg-amber-500',
  empty: 'bg-zinc-600',
}

export function TranslationCell({
  value,
  status,
  charLimit,
  isEditing,
  isSaving,
  editValue,
  presenceColor,
  isReadonly,
  onEditValueChange,
  onFocused,
  onBlurred,
  onSave,
  onCancel,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus()
      const len = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(len, len)
    }
  }, [isEditing])

  if (isEditing) {
    const overLimit = charLimit !== null && editValue.length > charLimit
    return (
      <div className="relative border-l-2 border-blue-500 h-full">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onFocus={onFocused}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              onSave()
            }
            if (e.key === 'Escape') onCancel()
          }}
          onBlur={() => {
            onBlurred()
            if (editValue !== (value ?? '')) {
              onSave()
            } else {
              onCancel()
            }
          }}
          className="w-full h-full resize-none overflow-y-auto select-text bg-muted text-foreground text-sm px-3 py-2 focus:outline-none leading-relaxed"
          placeholder="Enter translation…"
        />
        {charLimit !== null && (
          <div
            className={cn(
              'absolute bottom-1 right-2 text-[10px] pointer-events-none',
              overLimit ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {editValue.length}/{charLimit}
          </div>
        )}
      </div>
    )
  }

  const isEmpty = !value
  const dotColor = status ? (STATUS_DOT[status] ?? null) : null

  return (
    <div
      className={cn(
        'relative h-full w-full px-3 py-2 flex flex-col justify-start text-sm transition-colors',
        isReadonly ? 'cursor-default bg-card/30' : 'cursor-default hover:bg-muted/60',
        isEmpty ? 'text-muted-foreground italic' : 'text-foreground',
        presenceColor && 'ring-inset ring-1'
      )}
      style={presenceColor ? { '--tw-ring-color': presenceColor } as React.CSSProperties : undefined}
    >
      {isSaving ? (
        <span className="text-muted-foreground not-italic">Saving…</span>
      ) : (
        <span className="whitespace-pre-wrap break-words leading-relaxed line-clamp-3">{isEmpty ? '—' : value}</span>
      )}
      {dotColor && !isReadonly && (
        <span
          role="img"
          aria-label={`Status: ${status}`}
          title={`Status: ${status}`}
          className={cn('absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full', dotColor)}
        />
      )}
      {isReadonly && (
        <span className="absolute top-1.5 right-1.5 text-border">
          <Lock className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  )
}
