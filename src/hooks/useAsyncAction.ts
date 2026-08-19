'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tracks the pending state of a promise-returning handler.
 *
 * Every async action in the app needs the same three things: ignore clicks
 * while one is in flight, expose a pending flag for the UI, and clear it even
 * when the action throws. Hand-rolling that per component produced a different
 * shape each time — `loading`, `saving`, `deleting`, `revoking`, a per-row map,
 * a `useTransition` — and any of them is easy to forget entirely.
 *
 * `run` never rejects. Handlers in this app surface their own failures as a
 * toast; if one rejects anyway that is a bug in the handler, so the rejection
 * is logged rather than swallowed — but it is not re-thrown, which would turn
 * every such bug into an unhandled exception on the click path.
 */
export function useAsyncAction<Args extends unknown[]>(
  action: (...args: Args) => void | Promise<unknown>
): { run: (...args: Args) => void; pending: boolean } {
  const [pending, setPending] = useState(false)
  const mounted = useRef(true)
  const inFlight = useRef(false)

  // The ref must be re-armed in the effect body, not just initialised: React
  // StrictMode mounts, cleans up, then mounts again, and a ref initialiser runs
  // only once. Setting it false in cleanup alone left it false for the second
  // mount, so setPending(false) never ran and the spinner stuck forever.
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const run = useCallback((...args: Args) => {
    if (inFlight.current) return
    const result = action(...args)
    if (!(result instanceof Promise)) return

    inFlight.current = true
    setPending(true)
    result
      .catch((error: unknown) => {
        console.error('Async action failed without handling its own error:', error)
      })
      .finally(() => {
        inFlight.current = false
        if (mounted.current) setPending(false)
      })
  }, [action])

  return { run, pending }
}
