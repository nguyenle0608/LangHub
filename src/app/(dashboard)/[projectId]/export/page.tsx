import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/session'
import { getProject } from '@/lib/supabase/queries/projects'
import { ExportPageClient } from '@/components/export/ExportPageClient'

export default async function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const project = await getProject(projectId)
  if (!project) notFound()

  return <ExportPageClient project={project} />
}
