import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/session'
import { getProject } from '@/lib/supabase/queries/projects'
import { findDuplicateGroups } from '@/lib/supabase/queries/keys'
import { resolveBranchId } from '@/lib/branches/queries'
import { DuplicateFinder } from '@/components/keys/DuplicateFinder'

export default async function KeysPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ branch?: string }>
}) {
  const { projectId } = await params
  const { branch } = await searchParams
  const user = await getUser()
  if (!user) redirect('/login')

  const branchId = await resolveBranchId(projectId, branch)
  if (!branchId) notFound()

  const [project, groups] = await Promise.all([
    getProject(projectId),
    findDuplicateGroups(projectId, branchId),
  ])
  if (!project) notFound()

  return (
    <DuplicateFinder
      project={project}
      initialGroups={groups}
    />
  )
}
