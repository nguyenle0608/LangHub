import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/auth'
import { getProjectsByOrg } from '@/lib/supabase/queries/projects'
import { getOrganizations } from '@/lib/supabase/queries/organizations'
import { ProjectsPageClient } from '@/components/projects/ProjectsPageClient'

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { org?: string }
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const orgs = await getOrganizations(user.id)

  if (orgs.length === 0) {
    redirect('/setup')
  }

  const currentOrgId = searchParams.org ?? orgs[0]?.id ?? ''

  if (!searchParams.org && orgs[0]) {
    redirect(`/projects?org=${orgs[0].id}`)
  }

  const projects = await getProjectsByOrg(currentOrgId)

  return (
    <ProjectsPageClient
      projects={projects}
      orgs={orgs}
      currentOrgId={currentOrgId}
      userEmail={user.email}
    />
  )
}
