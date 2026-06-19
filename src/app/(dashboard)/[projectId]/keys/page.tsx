import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/auth'
import { getProject } from '@/lib/supabase/queries/projects'
import { findDuplicateGroups } from '@/lib/supabase/queries/keys'
import { DuplicateFinder } from '@/components/keys/DuplicateFinder'

export default async function KeysPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const [project, groups] = await Promise.all([
    getProject(projectId),
    findDuplicateGroups(projectId),
  ])
  if (!project) notFound()

  return (
    <DuplicateFinder
      project={project}
      initialGroups={groups}
    />
  )
}
