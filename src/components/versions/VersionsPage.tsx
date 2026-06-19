'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, RotateCcw, GitBranch, Zap, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { VersionDiffView } from './VersionDiffView'
import type { VersionWithStats } from '@/lib/versions/snapshot'
import type { ProjectWithStats } from '@/types'

interface Props {
  project: ProjectWithStats
  initialVersions: VersionWithStats[]
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString()
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
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-zinc-100 mb-4">Create Version Snapshot</h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Version name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="v1.2.0 — Release candidate"
              className="text-sm bg-zinc-800 border-zinc-700"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What changed in this version…"
              rows={2}
              className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="border-zinc-700" onClick={onClose}>
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
}: {
  version: VersionWithStats
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const isManual = version.tag === 'manual'
  const stats = version.stats
  const total = stats ? (stats.total_keys ?? 0) * (stats.total_locales ?? 0) : 0
  const approved = stats?.approved_count ?? 0
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left rounded-lg border p-3.5 transition-colors hover:bg-zinc-800/40 space-y-2',
        isSelected ? 'border-blue-500/60 bg-blue-500/5' : 'border-zinc-800 bg-zinc-900/40',
        !isManual && 'opacity-80',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          {isManual
            ? <GitBranch className="h-3.5 w-3.5 text-blue-400" />
            : <Zap className="h-3.5 w-3.5 text-zinc-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={['text-sm font-medium truncate', isManual ? 'text-zinc-100' : 'text-zinc-400'].join(' ')}>
              {version.name}
            </span>
            {!isManual && (
              <Badge variant="outline" className="text-[9px] text-zinc-500 border-zinc-700 py-0 px-1">auto</Badge>
            )}
          </div>
          {version.description && (
            <p className="text-[11px] text-zinc-500 truncate mt-0.5">{version.description}</p>
          )}
        </div>
        {isManual && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-zinc-700 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 mt-0.5"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="text-[10px] text-zinc-600">{timeAgo(version.created_at)}</div>

      {stats && (
        <>
          <div className="text-[11px] text-zinc-500">
            {stats.total_keys ?? 0} keys · {stats.total_locales ?? 0} locales
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 tabular-nums">{pct}%</span>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="text-green-400">{approved} ✅</span>
            <span className="text-yellow-400">{stats.pending_count ?? 0} ⏳</span>
            <span className="text-zinc-500">{stats.empty_count ?? 0} ○</span>
          </div>
        </>
      )}
    </button>
  )
}

export function VersionsPage({ project, initialVersions }: Props) {
  const [versions, setVersions] = useState(initialVersions)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    initialVersions[0]?.id ?? null
  )
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = versions.filter((v) =>
    !search || v.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedVersion = versions.find((v) => v.id === selectedVersionId)

  const handleDelete = async (versionId: string) => {
    const v = versions.find((ver) => ver.id === versionId)
    const resp = await fetch(`/api/versions/${versionId}`, { method: 'DELETE' })
    const data = await resp.json() as { error?: string }
    if (!resp.ok) { toast.error(data.error ?? 'Failed to delete'); return }
    setVersions((prev) => prev.filter((ver) => ver.id !== versionId))
    if (selectedVersionId === versionId) setSelectedVersionId(null)
    toast.success(`Deleted "${v?.name}"`)
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
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Left sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-zinc-800 flex flex-col">
        {/* Nav */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Link href={`/${project.id}/editor`} className="text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium text-zinc-200 flex-1">Versions</span>
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
        <div className="px-3 py-2 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search versions…"
              className="pl-7 h-7 text-xs bg-zinc-900 border-zinc-700"
            />
          </div>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-4 text-center">
              {versions.length === 0 ? (
                <>
                  <GitBranch className="h-7 w-7 text-zinc-700 mb-3" />
                  <p className="text-xs font-medium text-zinc-400 mb-1">No snapshots yet</p>
                  <p className="text-[11px] text-zinc-600 mb-3">Create one before your next import to track changes</p>
                  <Button size="sm" className="h-6 text-xs gap-1" onClick={() => setShowCreate(true)}>
                    <Plus className="h-3 w-3" />
                    New Snapshot
                  </Button>
                </>
              ) : (
                <p className="text-xs text-zinc-600">No results</p>
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
        <div className="flex-1 flex items-center justify-center text-zinc-600">
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
