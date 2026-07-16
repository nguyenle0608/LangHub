import { notFound } from 'next/navigation'
import { getProjectLite } from '@/lib/supabase/queries/projects'
import { getVersions } from '@/lib/versions/snapshot'
import { VersionsPage } from '@/components/versions/VersionsPage'

export default async function VersionsPageRoute({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const startedAt = Date.now()
  const { projectId } = await params

  const [project, versions] = await Promise.all([
    getProjectLite(projectId),
    getVersions(projectId),
  ])
  if (!project) notFound()

  if (process.env.NODE_ENV === 'development') {
    console.info(`[perf] /${projectId}/versions versions=${versions.length} total=${Date.now() - startedAt}ms`)
  }

  return <VersionsPage project={project} initialVersions={versions} />
}
