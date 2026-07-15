import { notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/session'
import { getProjectLite } from '@/lib/supabase/queries/projects'
import { getUserOrgRole } from '@/lib/supabase/queries/organizations'
import { getBranchesBootstrap, listBranchesWithStats } from '@/lib/branches/queries'
import { BranchesPage } from '@/components/branches/BranchesPage'

export default async function BranchesPageRoute({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const startedAt = Date.now()
  const { projectId } = await params
  const bootstrap = await getBranchesBootstrap(projectId)
  let project = bootstrap?.project ?? null
  let branches = bootstrap?.branches ?? []
  let role = bootstrap?.role ?? null

  if (!bootstrap) {
    project = await getProjectLite(projectId)
    if (!project) notFound()
    const fallbackProject = project

    const [fallbackBranches, fallbackRole] = await Promise.all([
      listBranchesWithStats(projectId),
      fallbackProject.org_id
        ? getUser().then((user) => user ? getUserOrgRole(fallbackProject.org_id!, user.id) : null)
        : Promise.resolve(null),
    ])
    branches = fallbackBranches
    role = fallbackRole
  }

  if (!project) notFound()

  if (process.env.NODE_ENV === 'development') {
    console.info(`[perf] /${projectId}/branches branches=${branches.length} total=${Date.now() - startedAt}ms`)
  }

  return (
    <BranchesPage
      project={project}
      initialBranches={branches}
      canManage={role === 'owner' || role === 'admin'}
    />
  )
}
