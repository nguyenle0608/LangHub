import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/auth'
import { getProject } from '@/lib/supabase/queries/projects'
import { getUserOrgRole } from '@/lib/supabase/queries/organizations'
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

  const role = project.org_id ? await getUserOrgRole(project.org_id, user.id) : null
  if (role !== 'owner') redirect(`/${params.projectId}/editor`)

  return <ProjectSettingsClient project={project} />
}
