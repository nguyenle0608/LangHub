'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface PresenceUser {
  userId: string
  email: string
  keyId: string | null
  localeId: string | null
  color: string
}

const COLORS = ['#60a5fa', '#34d399', '#f472b6', '#fb923c', '#a78bfa', '#facc15']

function colorForId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  return COLORS[Math.abs(hash) % COLORS.length] ?? '#60a5fa'
}

export function usePresence(
  projectId: string,
  user: { id: string; email?: string | undefined }
) {
  const [presences, setPresences] = useState<Map<string, PresenceUser>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`editing:${projectId}`, {
      config: { broadcast: { self: false, ack: false } },
    })

    channel
      .on(
        'broadcast',
        { event: 'cell' },
        ({ payload }: { payload: PresenceUser }) => {
          setPresences((prev) => {
            const next = new Map(prev)
            if (!payload.keyId) {
              next.delete(payload.userId)
            } else {
              next.set(payload.userId, payload)
            }
            return next
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [projectId, user.id])

  const sendBroadcast = useCallback(
    (keyId: string | null, localeId: string | null) => {
      const ch = channelRef.current
      if (!ch) return
      void ch.send({
        type: 'broadcast',
        event: 'cell',
        payload: {
          userId: user.id,
          email: user.email ?? '',
          keyId,
          localeId,
          color: colorForId(user.id),
        } satisfies PresenceUser,
      })
    },
    [user.id, user.email]
  )

  // Track a specific cell — cancels any pending clear
  const trackCell = useCallback(
    (keyId: string, localeId: string) => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
      sendBroadcast(keyId, localeId)
    },
    [sendBroadcast]
  )

  // Schedule clearing — delayed so blur→focus across cells fires only one broadcast
  const clearCell = useCallback(() => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    clearTimerRef.current = setTimeout(() => {
      clearTimerRef.current = null
      sendBroadcast(null, null)
    }, 150)
  }, [sendBroadcast])

  // Clear on tab switch
  useEffect(() => {
    const handleHide = () => {
      if (!document.hidden) return
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
      sendBroadcast(null, null)
    }
    document.addEventListener('visibilitychange', handleHide)
    return () => document.removeEventListener('visibilitychange', handleHide)
  }, [sendBroadcast])

  return {
    presences: Array.from(presences.values()),
    trackCell,
    clearCell,
  }
}
