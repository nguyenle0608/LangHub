import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/session'
import { getProject } from '@/lib/supabase/queries/projects'
import { getVersions } from '@/lib/versions/snapshot'
import { VersionsPage } from '@/components/versions/VersionsPage'

export default async function VersionsPageRoute({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const [project, versions] = await Promise.all([
    getProject(projectId),
    getVersions(projectId),
  ])
  if (!project) notFound()

  return <VersionsPage project={project} initialVersions={versions} />
}
