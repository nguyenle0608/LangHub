import { notFound } from 'next/navigation'
import { getProjectLite } from '@/lib/supabase/queries/projects'
import { ImportWizard } from '@/components/import/ImportWizard'

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ branch?: string }>
}) {
  const startedAt = Date.now()
  const { projectId } = await params
  const { branch } = await searchParams

  const project = await getProjectLite(projectId)
  if (!project) notFound()

  if (process.env.NODE_ENV === 'development') {
    console.info(`[perf] /${projectId}/import locales=${project.locales.length} total=${Date.now() - startedAt}ms`)
  }

  return <ImportWizard project={project} branchId={branch} />
}
