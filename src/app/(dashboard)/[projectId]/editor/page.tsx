import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/session'
import { getProject } from '@/lib/supabase/queries/projects'
import { getTranslationKeys } from '@/lib/supabase/queries/translations'
import { getUserOrgRole } from '@/lib/supabase/queries/organizations'
import { listBranches, resolveBranchId } from '@/lib/branches/queries'
import { TranslationTable } from '@/components/editor/TranslationTable'

interface Props {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ branch?: string }>
}

export default async function EditorPage({ params, searchParams }: Props) {
  const { projectId } = await params
  const { branch: branchParam } = await searchParams
  const user = await getUser()
  if (!user) redirect('/login')

  const project = await getProject(projectId)
  if (!project) notFound()

  const [branches, activeBranchId] = await Promise.all([
    listBranches(projectId),
    resolveBranchId(projectId, branchParam),
  ])
  if (!activeBranchId) notFound()

  const keys = await getTranslationKeys(projectId, activeBranchId)

  const role = project.org_id
    ? await getUserOrgRole(project.org_id, user.id)
    : null

  return (
    <TranslationTable
      project={project}
      initialKeys={keys}
      branches={branches}
      activeBranchId={activeBranchId}
      user={{ id: user.id, email: user.email ?? undefined, role: role ?? 'viewer' }}
    />
  )
}
