import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/session'
import { getProjectsByOrg } from '@/lib/supabase/queries/projects'
import { getOrganizations } from '@/lib/supabase/queries/organizations'
import { ProjectsPageClient } from '@/components/projects/ProjectsPageClient'

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { org?: string }
}) {
  const startedAt = Date.now()
  const user = await getUser()
  if (!user) redirect('/login')

  const requestedOrgId = searchParams.org
  const orgsPromise = getOrganizations(user.id)
  const projectsPromise = requestedOrgId ? getProjectsByOrg(requestedOrgId) : null
  const orgs = await orgsPromise

  if (orgs.length === 0) {
    redirect('/dashboard/setup')
  }

  const currentOrgId = requestedOrgId ?? orgs[0]?.id ?? ''
  const projects = projectsPromise ? await projectsPromise : await getProjectsByOrg(currentOrgId)
  const currentOrg = orgs.find((o) => o.id === currentOrgId)

  if (process.env.NODE_ENV === 'development') {
    console.info(
      `[perf] /dashboard/projects orgs=${orgs.length} projects=${projects.length} total=${Date.now() - startedAt}ms`
    )
  }

  return (
    <ProjectsPageClient
      projects={projects}
      orgs={orgs}
      currentOrgId={currentOrgId}
      userEmail={user.email}
      userRole={currentOrg?.role ?? 'viewer'}
      hasOrgParam={!!searchParams.org}
    />
  )
}
