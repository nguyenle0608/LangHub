import { redirect } from 'next/navigation'
import { getSession } from '@/lib/supabase/session'
import { AuthWatcher } from '@/components/AuthWatcher'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Fast UX gate only. Page data still goes through Supabase RLS/RPC auth.uid().
  // Avoid auth.getUser() here because it adds a remote Auth round-trip to every dashboard page.
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <>
      <AuthWatcher />
      {children}
    </>
  )
}
