import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/session'
import { getProject } from '@/lib/supabase/queries/projects'
import { getUserOrgRole } from '@/lib/supabase/queries/organizations'
import { listBranchesWithStats } from '@/lib/branches/queries'
import { BranchesPage } from '@/components/branches/BranchesPage'

export default async function BranchesPageRoute({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const project = await getProject(projectId)
  if (!project) notFound()

  const [branches, role] = await Promise.all([
    listBranchesWithStats(projectId),
    project.org_id ? getUserOrgRole(project.org_id, user.id) : Promise.resolve(null),
  ])

  return (
    <BranchesPage
      project={project}
      initialBranches={branches}
      canManage={role === 'owner' || role === 'admin'}
    />
  )
}
