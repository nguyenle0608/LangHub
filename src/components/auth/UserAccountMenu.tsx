'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CreditCard, KeyRound, LogOut, Settings, ShieldCheck } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface UserAccountMenuProps {
  email?: string
  role?: string | null
  plan?: string | null
  avatarColor?: string
  avatarClassName?: string
}

export function UserAccountMenu({
  email,
  role,
  plan,
  avatarColor,
  avatarClassName,
}: UserAccountMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loggingOut, setLoggingOut] = useState(false)
  const displayEmail = email ?? 'Unknown'
  const initial = (email?.[0] ?? '?').toUpperCase()
  const backgroundColor = avatarColor ?? stringToColor(email ?? 'user')
  const planLabel = formatPlan(plan)

  async function handleSignOut() {
    setLoggingOut(true)
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  function handleAccountSettings() {
    const query = searchParams.toString()
    const currentPath = query ? `${pathname}?${query}` : pathname
    router.push(`/dashboard/account?next=${encodeURIComponent(currentPath)}`)
  }

  function handleChangePassword() {
    router.push('/change-password')
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white hover:ring-2 hover:ring-blue-500/50 transition-all',
            avatarClassName
          )}
          style={{ backgroundColor }}
          title={email}
        >
          {initial}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 bg-popover border-border overflow-hidden" align="end">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="text-sm text-foreground font-medium truncate mt-0.5">{displayEmail}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CreditCard className="h-3 w-3" />
              {planLabel}
            </span>
            {role && (
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                role === 'owner' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' :
                role === 'admin' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
                role === 'translator' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' :
                'bg-muted text-muted-foreground'
              )}>
                <ShieldCheck className="h-3 w-3" />
                {role}
              </span>
            )}
          </div>
        </div>
        <div className="p-1">
          <button
            type="button"
            onClick={handleAccountSettings}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Account settings
          </button>
          <button
            type="button"
            onClick={handleChangePassword}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Change password
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={loggingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 55%, 40%)`
}

function formatPlan(plan?: string | null): string {
  if (!plan) return 'Free account'
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} account`
}
