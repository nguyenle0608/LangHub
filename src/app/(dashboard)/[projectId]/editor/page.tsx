import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/auth'
import { getProject } from '@/lib/supabase/queries/projects'
import { getTranslationKeys } from '@/lib/supabase/queries/translations'
import { getUserOrgRole } from '@/lib/supabase/queries/organizations'
import { TranslationTable } from '@/components/editor/TranslationTable'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function EditorPage({ params }: Props) {
  const { projectId } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const [project, keys] = await Promise.all([
    getProject(projectId),
    getTranslationKeys(projectId),
  ])

  if (!project) notFound()

  const role = project.org_id
    ? await getUserOrgRole(project.org_id, user.id)
    : null

  return (
    <TranslationTable
      project={project}
      initialKeys={keys}
      user={{ id: user.id, email: user.email ?? undefined, role: role ?? 'viewer' }}
    />
  )
}
