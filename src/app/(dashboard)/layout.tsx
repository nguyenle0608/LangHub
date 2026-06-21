import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/session'
import { AuthWatcher } from '@/components/AuthWatcher'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  return (
    <>
      <AuthWatcher initialUserId={user.id} />
      {children}
    </>
  )
}
