import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/auth'
import { getOrganizations, getOrgMembers } from '@/lib/supabase/queries/organizations'
import { OrgSettingsClient } from '@/components/organizations/OrgSettingsClient'

export default async function OrgSettingsPage({ params }: { params: { orgId: string } }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const orgs = await getOrganizations(user.id)
  const org = orgs.find((o) => o.id === params.orgId)

  if (!org) notFound()

  // Only owner/admin can access settings
  if (org.role !== 'owner' && org.role !== 'admin') {
    redirect(`/projects?org=${params.orgId}`)
  }

  const members = await getOrgMembers(params.orgId)

  return (
    <OrgSettingsClient
      org={org}
      members={members}
      currentUserId={user.id}
    />
  )
}
