import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/auth'
import { getProject } from '@/lib/supabase/queries/projects'
import { ProjectSettingsClient } from '@/components/projects/ProjectSettingsClient'

export default async function SettingsPage({
  params,
}: {
  params: { projectId: string }
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const project = await getProject(params.projectId)
  if (!project) notFound()

  return <ProjectSettingsClient project={project} />
}
