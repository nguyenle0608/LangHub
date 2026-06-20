import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/auth'
import { getProject } from '@/lib/supabase/queries/projects'
import { getTranslationKeys } from '@/lib/supabase/queries/translations'
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

  return (
    <TranslationTable
      project={project}
      initialKeys={keys}
      user={{ id: user.id, email: user.email ?? undefined }}
    />
  )
}
