'use client'

import { useState, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

type Side = 'top' | 'right' | 'bottom' | 'left'

interface Props {
  content: ReactNode
  side?: Side
  className?: string
  contentClassName?: string
  children: ReactNode
}

// Lightweight hover/focus tooltip. Rendered through a portal on <body> so it is
// never clipped by an ancestor's overflow (e.g. the scrollable sidebar). No
// external dependency — keeps the install footprint unchanged.
export function Tooltip({ content, side = 'top', className, contentClassName, children }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  const show = () => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 8
    const point =
      side === 'top' ? { top: r.top - gap, left: r.left + r.width / 2 } :
      side === 'bottom' ? { top: r.bottom + gap, left: r.left + r.width / 2 } :
      side === 'right' ? { top: r.top + r.height / 2, left: r.right + gap } :
      { top: r.top + r.height / 2, left: r.left - gap }
    setPos(point)
    setOpen(true)
  }

  const transform =
    side === 'top' ? 'translate(-50%, -100%)' :
    side === 'bottom' ? 'translate(-50%, 0)' :
    side === 'right' ? 'translate(0, -50%)' :
    'translate(-100%, -50%)'

  return (
    <span
      ref={ref}
      className={cn('inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && typeof document !== 'undefined' && createPortal(
        <span
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform }}
          className={cn(
            'z-50 max-w-[260px] rounded-md border border-border bg-popover px-2.5 py-1.5',
            'text-xs leading-relaxed text-popover-foreground shadow-lg pointer-events-none',
            contentClassName
          )}
        >
          {content}
        </span>,
        document.body
      )}
    </span>
  )
}
