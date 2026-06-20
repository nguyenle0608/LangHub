'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RealtimeUpdate {
  id: string
  branch_id: string | null
  key_id: string | null
  locale_id: string | null
  value: string | null
  status: string | null
  updated_at: string | null
}

export function useRealtime({
  keyIds,
  branchId,
  onUpdate,
}: {
  keyIds: string[]
  branchId: string
  onUpdate: (update: RealtimeUpdate) => void
}) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (keyIds.length === 0) return

    const keyIdSet = new Set(keyIds)
    const supabase = createClient()

    const handle = (payload: { new: RealtimeUpdate }) => {
      const record = payload.new
      // Only apply updates for the active branch — translations now diverge per branch.
      if (record.branch_id && record.branch_id !== branchId) return
      if (record.key_id && keyIdSet.has(record.key_id)) {
        onUpdateRef.current(record)
      }
    }

    const channel = supabase
      .channel(`translations-realtime-${branchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'translations' }, handle)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'translations' }, handle)
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyIds.join(','), branchId])
}
