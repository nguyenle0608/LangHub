import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/auth'
import { getProject } from '@/lib/supabase/queries/projects'
import { ImportWizard } from '@/components/import/ImportWizard'

export default async function ImportPage({
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

  const project = await getProject(projectId)
  if (!project) notFound()

  return <ImportWizard project={project} branchId={branch} />
}
