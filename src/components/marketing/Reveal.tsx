'use client'

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  /** Stagger delay in ms, applied as inline transition-delay. */
  delay?: number
  /** Element to render as. Defaults to a div. */
  as?: ElementType
  className?: string
}

/**
 * Reveals children on scroll using IntersectionObserver.
 * Falls back to visible immediately when prefers-reduced-motion is set,
 * and is SSR-safe (renders hidden, then animates in on the client).
 */
export function Reveal({ children, delay = 0, as, className = '' }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType
  const [visible, setVisible] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Callback ref: begins observing as soon as the node is attached.
  const setNode = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect()
    if (!node) return

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(node)
    observerRef.current = observer
  }, [])

  // Safety net: never leave content hidden if the observer never fires.
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 1200)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Tag
      ref={setNode}
      data-reveal
      data-visible={visible ? 'true' : 'false'}
      style={{ transitionDelay: `${delay}ms` }}
      className={className}
    >
      {children}
    </Tag>
  )
}
