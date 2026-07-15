import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/session'
import { getEditorBootstrap, getProjectLite } from '@/lib/supabase/queries/projects'
import { getTranslationKeysPage } from '@/lib/supabase/queries/translations'
import { getUserOrgRole } from '@/lib/supabase/queries/organizations'
import { listBranches } from '@/lib/branches/queries'
import { TranslationTable } from '@/components/editor/TranslationTable'

// First-paint window: ship this many keys server-side, stream the rest
// client-side. Sized to fill the viewport comfortably without a heavy payload.
const INITIAL_KEYS = 200

interface Props {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ branch?: string }>
}

export default async function EditorPage({ params, searchParams }: Props) {
  const startedAt = Date.now()
  const { projectId } = await params
  const { branch: branchParam } = await searchParams
  const user = await getUser()
  if (!user) redirect('/login')

  const bootstrap = await getEditorBootstrap(projectId, branchParam)
  let project = bootstrap?.project ?? null
  let branches = bootstrap?.branches ?? []
  let activeBranchId = bootstrap?.activeBranchId ?? null
  let role = bootstrap?.role ?? null

  if (!bootstrap) {
    const [fallbackProject, fallbackBranches] = await Promise.all([
      getProjectLite(projectId),
      listBranches(projectId),
    ])
    project = fallbackProject
    branches = fallbackBranches
    const requestedBranch = branchParam
      ? branches.find((branch) => branch.id === branchParam)
      : undefined
    activeBranchId =
      requestedBranch?.id ??
      branches.find((branch) => branch.is_default)?.id ??
      branches[0]?.id ??
      null
  }

  if (!project || !activeBranchId) notFound()

  const [{ keys, total }, fallbackRole] = await Promise.all([
    getTranslationKeysPage(projectId, activeBranchId, { limit: INITIAL_KEYS, includeCount: true }),
    role === null && project.org_id ? getUserOrgRole(project.org_id, user.id) : Promise.resolve(null),
  ])
  role ??= fallbackRole
  const totalKeys = total ?? keys.length

  if (process.env.NODE_ENV === 'development') {
    console.info(
      `[perf] /${projectId}/editor branches=${branches.length} keys=${keys.length}/${totalKeys} total=${Date.now() - startedAt}ms`
    )
  }

  return (
    <TranslationTable
      project={project}
      initialKeys={keys}
      totalKeyCount={totalKeys}
      branches={branches}
      activeBranchId={activeBranchId}
      user={{ id: user.id, email: user.email ?? undefined, role: role ?? 'viewer' }}
    />
  )
}
