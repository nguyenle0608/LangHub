import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/auth'
import { getOrganizations } from '@/lib/supabase/queries/organizations'
import { SetupClient } from './SetupClient'

export default async function SetupPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  // If user already has orgs, redirect to projects
  const orgs = await getOrganizations(user.id)
  if (orgs.length > 0 && orgs[0]) {
    redirect(`/projects?org=${orgs[0].id}`)
  }

  return <SetupClient />
}
