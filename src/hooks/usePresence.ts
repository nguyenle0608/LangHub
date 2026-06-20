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
  const [presences, setPresences] = useState<PresenceUser[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`presence:${projectId}`, {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        const all = Object.values(state).flat()
        setPresences(all.filter((p) => p.userId !== user.id))
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [projectId, user.id])

  const trackCell = useCallback(
    async (keyId: string | null, localeId: string | null) => {
      const ch = channelRef.current
      if (!ch) return
      await ch.track({
        userId: user.id,
        email: user.email ?? '',
        keyId,
        localeId,
        color: colorForId(user.id),
      })
    },
    [user.id, user.email]
  )

  return { presences, trackCell }
}
