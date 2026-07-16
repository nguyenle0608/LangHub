'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, RotateCcw, GitBranch, Zap, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// Diff view is only shown after a version is selected — lazy-load it.
const VersionDiffView = dynamic(() => import('./VersionDiffView').then((m) => m.VersionDiffView))
import type { VersionWithStats } from '@/lib/versions/snapshot'
import type { ProjectWithStats } from '@/types'

interface Props {
  project: ProjectWithStats
  initialVersions: VersionWithStats[]
}

function formatVersionDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function CreateVersionDialog({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string
  onClose: () => void
  onCreated: (v: VersionWithStats) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const resp = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, name: name.trim(), description: description.trim() || undefined }),
      })
      const data = await resp.json() as { data?: VersionWithStats; error?: string }
      if (!resp.ok) { toast.error(data.error ?? 'Failed'); return }
      toast.success(`Version "${name}" created`)
      onCreated(data.data!)
      onClose()
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Create Version Snapshot</h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Version name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="v1.2.0 — Release candidate"
              className="text-sm bg-muted border-border"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What changed in this version…"
              rows={2}
              className="w-full text-sm bg-muted border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="border-border" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading || !name.trim()}>
              {loading ? 'Creating…' : 'Create Snapshot'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VersionCard({
  version,
  isSelected,
  onSelect,
  onDelete,
  deleting,
}: {
  version: VersionWithStats
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const isManual = version.tag === 'manual'
  const stats = version.stats
  const total = stats ? (stats.total_keys ?? 0) * (stats.total_locales ?? 0) : 0
  const approved = stats?.approved_count ?? 0
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={[
        'w-full text-left rounded-lg border p-3.5 transition-colors hover:bg-muted/40 space-y-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/60',
        isSelected ? 'border-blue-500/60 bg-blue-500/5' : 'border-border bg-card/40',
        !isManual && 'opacity-80',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          {isManual
            ? <GitBranch className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            : <Zap className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={['text-sm font-medium truncate', isManual ? 'text-foreground' : 'text-muted-foreground'].join(' ')}>
              {version.name}
            </span>
            {!isManual && (
              <Badge variant="outline" className="text-[9px] text-muted-foreground border-border py-0 px-1">auto</Badge>
            )}
          </div>
          {version.description && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{version.description}</p>
          )}
        </div>
        {isManual && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            disabled={deleting}
            className="text-border hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 mt-0.5 disabled:opacity-100"
          >
            {deleting
              ? <Loader2 className="h-3 w-3 animate-spin text-destructive" />
              : <Trash2 className="h-3 w-3" />}
          </button>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground">{formatVersionDate(version.created_at)}</div>

      {stats && (
        <>
          <div className="text-[11px] text-muted-foreground">
            {stats.total_keys ?? 0} keys · {stats.total_locales ?? 0} locales
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="text-green-400">{approved} ✅</span>
            <span className="text-yellow-400">{stats.pending_count ?? 0} ⏳</span>
            <span className="text-muted-foreground">{stats.empty_count ?? 0} ○</span>
          </div>
        </>
      )}
    </div>
  )
}

export function VersionsPage({ project, initialVersions }: Props) {
  const [versions, setVersions] = useState(initialVersions)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = versions.filter((v) =>
    !search || v.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedVersion = versions.find((v) => v.id === selectedVersionId)

  const handleDelete = async (versionId: string) => {
    if (deletingId) return
    const v = versions.find((ver) => ver.id === versionId)
    setDeletingId(versionId)
    try {
      const resp = await fetch(`/api/versions/${versionId}`, { method: 'DELETE' })
      const data = await resp.json() as { error?: string }
      if (!resp.ok) { toast.error(data.error ?? 'Failed to delete'); return }
      setVersions((prev) => prev.filter((ver) => ver.id !== versionId))
      if (selectedVersionId === versionId) setSelectedVersionId(null)
      toast.success(`Deleted "${v?.name}"`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreated = (v: VersionWithStats) => {
    setVersions((prev) => [v, ...prev])
    setSelectedVersionId(v.id)
  }

  const handleRestored = async () => {
    // Refresh versions list to show new auto-backup
    const resp = await fetch(`/api/versions?projectId=${project.id}`)
    const data = await resp.json() as { data?: VersionWithStats[] }
    if (data.data) setVersions(data.data)
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Left sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        {/* Nav */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Link href={`/dashboard/${project.id}/editor`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium text-foreground flex-1">Versions</span>
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search versions…"
              className="pl-7 h-7 text-xs bg-card border-border"
            />
          </div>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-4 text-center">
              {versions.length === 0 ? (
                <>
                  <GitBranch className="h-7 w-7 text-border mb-3" />
                  <p className="text-xs font-medium text-muted-foreground mb-1">No snapshots yet</p>
                  <p className="text-[11px] text-muted-foreground mb-3">Create one before your next import to track changes</p>
                  <Button size="sm" className="h-6 text-xs gap-1" onClick={() => setShowCreate(true)}>
                    <Plus className="h-3 w-3" />
                    New Snapshot
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No results</p>
              )}
            </div>
          ) : (
            <div className="group space-y-2">
              {filtered.map((v) => (
                <VersionCard
                  key={v.id}
                  version={v}
                  isSelected={v.id === selectedVersionId}
                  onSelect={() => setSelectedVersionId(v.id)}
                  onDelete={() => handleDelete(v.id)}
                  deleting={deletingId === v.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: diff view */}
      {selectedVersion ? (
        <VersionDiffView
          projectId={project.id}
          versionA={selectedVersion}
          versions={versions}
          onRestored={handleRestored}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <RotateCcw className="h-8 w-8 mx-auto opacity-20" />
            <p className="text-sm">{versions.length === 0 ? 'Create a snapshot to start tracking' : 'Select a version to compare'}</p>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateVersionDialog
          projectId={project.id}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
