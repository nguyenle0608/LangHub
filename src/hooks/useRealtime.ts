'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RealtimeUpdate {
  id: string
  key_id: string | null
  locale_id: string | null
  value: string | null
  status: string | null
  updated_at: string | null
}

export function useRealtime({
  keyIds,
  onUpdate,
}: {
  keyIds: string[]
  onUpdate: (update: RealtimeUpdate) => void
}) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (keyIds.length === 0) return

    const keyIdSet = new Set(keyIds)
    const supabase = createClient()

    const channel = supabase
      .channel('translations-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'translations' },
        (payload) => {
          const record = payload.new as RealtimeUpdate
          if (record.key_id && keyIdSet.has(record.key_id)) {
            onUpdateRef.current(record)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'translations' },
        (payload) => {
          const record = payload.new as RealtimeUpdate
          if (record.key_id && keyIdSet.has(record.key_id)) {
            onUpdateRef.current(record)
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyIds.join(',')])
}
