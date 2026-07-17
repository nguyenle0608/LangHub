'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { LayoutGrid, List, ArrowUpDown, Plus, Trash2, X } from 'lucide-react'
import { ThemeHeaderButton } from '@/components/theme/ThemeHeaderButton'
import { Logo } from '@/components/Logo'
import { toast } from 'sonner'
import { ProjectCard } from './ProjectCard'
import { OrgSwitcher } from '@/components/organizations/OrgSwitcher'
import { Button } from '@/components/ui/button'
import { UserAccountMenu } from '@/components/auth/UserAccountMenu'
import type { OrgWithStats, ProjectWithStats } from '@/types'

const CreateProjectDialog = dynamic(() => import('./CreateProjectDialog').then((m) => m.CreateProjectDialog))
const CreateOrgDialog = dynamic(() => import('@/components/organizations/CreateOrgDialog').then((m) => m.CreateOrgDialog))

type SortKey = 'name' | 'percent' | 'keys' | 'updated'
type ViewMode = 'grid' | 'list'

interface Props {
  projects: ProjectWithStats[]
  orgs: OrgWithStats[]
  currentOrgId: string
  userEmail: string | undefined
  userRole: string
  hasOrgParam: boolean
}

function sortProjects(projects: ProjectWithStats[], sort: SortKey): ProjectWithStats[] {
  return [...projects].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'percent') return b.overall_percent - a.overall_percent
    if (sort === 'keys') return b.key_count - a.key_count
    return 0
  })
}

export function ProjectsPageClient({ projects, orgs, currentOrgId, userEmail, userRole, hasOrgParam }: Props) {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>('grid')
  const [sort, setSort] = useState<SortKey>('name')
  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [isSwitchingOrg, startOrgSwitch] = useTransition()
  const [switchingToOrgId, setSwitchingToOrgId] = useState<string | null>(null)

  useEffect(() => {
    if (!isSwitchingOrg) setSwitchingToOrgId(null)
  }, [isSwitchingOrg])

  // Silently update URL with default org — avoids server-side redirect flash
  useEffect(() => {
    if (!hasOrgParam && currentOrgId) {
      window.history.replaceState(null, '', `/dashboard/projects?org=${currentOrgId}`)
    }
  }, [hasOrgParam, currentOrgId])

  const canDelete = userRole === 'owner'

  const sorted = sortProjects(projects, sort)


  function handleOrgSwitch(orgId: string) {
    setSwitchingToOrgId(orgId)
    startOrgSwitch(() => {
      router.push(`/dashboard/projects?org=${orgId}`)
    })
  }

  function handleOrgCreated(orgId: string) {
    router.push(`/dashboard/projects?org=${orgId}`)
    router.refresh()
  }

  const currentOrg = orgs.find((o) => o.id === currentOrgId)
  const canManageOrg = currentOrg?.role === 'owner' || currentOrg?.role === 'admin'

  return (
    <div className="min-h-screen bg-background text-foreground">
      {createOrgOpen && (
        <CreateOrgDialog
          open={createOrgOpen}
          onOpenChange={setCreateOrgOpen}
          onCreated={handleOrgCreated}
        />
      )}
      {createProjectOpen && (
        <CreateProjectDialog
          orgId={currentOrgId}
          open={createProjectOpen}
          onOpenChange={setCreateProjectOpen}
        />
      )}
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Left: logo + org switcher */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 group">
              <Logo size={30} />
              <span className="font-semibold text-foreground tracking-tight hidden sm:inline group-hover:text-foreground">LangHub</span>
            </Link>
            <span className="text-border hidden sm:inline">/</span>
            <OrgSwitcher
              orgs={orgs}
              currentOrgId={currentOrgId}
              canManageOrg={canManageOrg}
              onSwitch={handleOrgSwitch}
              onCreateNew={() => setCreateOrgOpen(true)}
              switchingToId={switchingToOrgId}
            />
          </div>

          {/* Right: theme action + user avatar dropdown */}
          <div className="flex items-center gap-2">
            <ThemeHeaderButton />
            <UserAccountMenu email={userEmail} role={userRole} plan={currentOrg?.plan} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {projects.length === 0
                ? 'Create your first project to get started'
                : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-1">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort projects"
                className="text-xs bg-transparent text-muted-foreground outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <option value="name">Name</option>
                <option value="percent">Progress</option>
                <option value="keys">Keys</option>
              </select>
            </div>

            {/* View toggle */}
            <div className="flex border border-border rounded-lg overflow-hidden" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
                className={`p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${view === 'grid' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-label="List view"
                aria-pressed={view === 'list'}
                className={`p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${view === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <Button
              className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 h-9 text-sm"
              onClick={() => setCreateProjectOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New Project
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-muted-foreground">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              Create your first project to start managing translations for your app.
            </p>
            <Button
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
              onClick={() => setCreateProjectOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create first project
            </Button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((project) => (
              <ProjectCard key={project.id} project={project} canDelete={canDelete} />
            ))}
          </div>
        ) : (
          /* List view */
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_60px_60px_40px] text-[11px] text-muted-foreground uppercase bg-muted/50 px-4 py-2.5 gap-4 border-b border-border">
              <div>Project</div>
              <div>Progress</div>
              <div>Keys</div>
              <div>Locales</div>
              <div />
            </div>
            {sorted.map((project) => (
              <ProjectListRow key={project.id} project={project} canDelete={canDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ProjectListRow({ project, canDelete }: { project: ProjectWithStats; canDelete: boolean }) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const percentColor =
    project.overall_percent >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
    project.overall_percent >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      toast.success(`"${project.name}" deleted`)
      router.refresh()
    } else {
      toast.error('Failed to delete project')
    }
    setConfirmDelete(false)
  }

  return (
    <div className="relative grid grid-cols-[1fr_80px_60px_60px_44px] px-4 py-3 gap-4 border-b border-border/60 last:border-0 hover:bg-muted/60 transition-colors items-center group">
      {/* Stretched link overlay: whole row navigates without nesting controls inside an anchor */}
      <Link
        href={`/dashboard/${project.id}/editor`}
        aria-label={`Open ${project.name} editor`}
        className="absolute inset-0 z-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <div className="pointer-events-none relative z-10 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
        {project.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{project.description}</p>
        )}
      </div>
      <div className="pointer-events-none relative z-10 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${project.overall_percent >= 80 ? 'bg-emerald-500' : project.overall_percent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${project.overall_percent}%` }}
          />
        </div>
        <span className={`text-xs tabular-nums font-medium w-7 text-right ${percentColor}`}>{project.overall_percent}%</span>
      </div>
      <span className="pointer-events-none relative z-10 text-sm text-muted-foreground tabular-nums">{project.key_count}</span>
      <span className="pointer-events-none relative z-10 text-sm text-muted-foreground tabular-nums">{project.locale_count}</span>
      <div className="relative z-10 flex items-center justify-end">
        {canDelete && (confirmDelete ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs bg-destructive text-destructive-foreground hover:opacity-90 rounded px-2 py-1 transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              aria-label="Cancel delete"
              className="border border-border text-muted-foreground hover:text-foreground rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete ${project.name}`}
            className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground opacity-70 transition-all hover:bg-accent hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  )
}
