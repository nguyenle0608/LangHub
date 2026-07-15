'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Props {
  initialUserId?: string | null
}

// Detects when a different account logs in on another tab (cookie overwrite).
// Checks on tab focus and on Supabase auth state changes.
export function AuthWatcher({ initialUserId = null }: Props) {
  const knownUserIdRef = useRef<string | null>(initialUserId)
  const notifiedRef = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    function notify() {
      if (notifiedRef.current) return
      notifiedRef.current = true
      toast.warning('Tài khoản đã thay đổi ở tab khác', {
        description: 'Tải lại trang để tiếp tục với phiên mới.',
        duration: Infinity,
        action: {
          label: 'Tải lại',
          onClick: () => window.location.reload(),
        },
      })
    }

    async function checkUser() {
      try {
        const { data } = await supabase.auth.getUser()
        const currentId = data.user?.id ?? null
        if (!currentId) return
        if (!knownUserIdRef.current) {
          knownUserIdRef.current = currentId
          return
        }
        if (currentId !== knownUserIdRef.current) {
          notify()
        }
      } catch {
        // Network/Auth hiccups on tab focus should not surface as app errors.
        // The next visibility/auth-state event will re-check the active user.
      }
    }

    // Check whenever this tab becomes visible again
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void checkUser()
      }
    }

    // Also catch in-tab auth state changes (e.g. token refresh with new user)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentId = session?.user?.id ?? null
      if (!currentId) return
      if (!knownUserIdRef.current) {
        knownUserIdRef.current = currentId
        return
      }
      if (currentId !== knownUserIdRef.current) {
        notify()
      }
    })

    void checkUser()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      subscription.unsubscribe()
    }
  }, [])

  return null
}
