'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, GitBranch, GitMerge, Plus, Trash2, Pencil, Check, Star, Lock, Loader2, ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MergeDialog } from '@/components/editor/MergeDialog'
import type { ProjectWithStats } from '@/types'
import type { Branch, BranchWithStats } from '@/lib/branches/queries'

interface Props {
  project: ProjectWithStats
  initialBranches: BranchWithStats[]
  canManage: boolean
}

function formatDate(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function BranchesPage({ project, initialBranches, canManage }: Props) {
  const router = useRouter()
  const [branches] = useState(initialBranches)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [sourceId, setSourceId] = useState(() => branches.find((b) => b.is_default)?.id ?? branches[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [mergeSource, setMergeSource] = useState<BranchWithStats | null>(null)

  const nameById = Object.fromEntries(branches.map((b) => [b.id, b.name]))
  const defaultBranch = branches.find((b) => b.is_default)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, name, sourceBranchId: sourceId }),
      })
      const json = await res.json() as { data?: Branch; error?: string }
      if (!res.ok || !json.data) { toast.error(json.error ?? 'Failed to create branch'); return }
      toast.success(`Branch "${name}" created`)
      setNewName(''); setCreating(false)
      router.refresh()
    } catch { toast.error('Network error') } finally { setBusy(false) }
  }

  async function handleRename(branch: Branch) {
    const name = renameValue.trim()
    if (!name || name === branch.name) { setRenamingId(null); return }
    setBusy(true)
    try {
      const res = await fetch('/api/branches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, branchId: branch.id, name }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) { toast.error(json.error ?? 'Rename failed'); return }
      toast.success('Branch renamed')
      setRenamingId(null)
      router.refresh()
    } catch { toast.error('Network error') } finally { setBusy(false) }
  }

  async function handleSetDefault(branch: Branch) {
    setBusy(true)
    try {
      const res = await fetch('/api/branches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, branchId: branch.id, setDefault: true }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) { toast.error(json.error ?? 'Failed'); return }
      toast.success(`"${branch.name}" is now the default branch`)
      router.refresh()
    } catch { toast.error('Network error') } finally { setBusy(false) }
  }

  async function handleDelete(branch: Branch) {
    if (!confirm(`Delete branch "${branch.name}"? This removes its keys and translations and cannot be undone.`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/branches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, branchId: branch.id }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) { toast.error(json.error ?? 'Delete failed'); return }
      toast.success(`Deleted "${branch.name}"`)
      router.refresh()
    } catch { toast.error('Network error') } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href={`/${project.id}/editor`} className="text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <GitBranch className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-zinc-200">Branches</span>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-zinc-400 truncate">{project.name}</span>
          <div className="flex-1" />
          {canManage && !creating && (
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> New branch
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Branches</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {branches.length} branch{branches.length !== 1 ? 'es' : ''} · isolated key sets you can edit and merge
          </p>
        </div>

        {/* New branch form */}
        {creating && (
          <form onSubmit={handleCreate} className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/40 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-zinc-500">Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="feature/checkout-copy" autoFocus className="h-8 text-sm bg-zinc-800 border-zinc-700" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-zinc-500">Fork from</label>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="h-8 text-sm bg-zinc-800 border border-zinc-700 rounded-md px-2 text-zinc-200 w-full sm:w-48"
                >
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setCreating(false); setNewName('') }}>Cancel</Button>
              <Button type="submit" size="sm" className="h-7 text-xs gap-1.5" disabled={busy || !newName.trim()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
              </Button>
            </div>
          </form>
        )}

        {/* Branch list */}
        <div className="space-y-2.5">
          {branches.map((b) => (
            <div key={b.id} className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors">
              <div className="flex items-start gap-3">
                <GitBranch className={cn('h-4 w-4 mt-0.5 flex-shrink-0', b.is_default ? 'text-blue-400' : 'text-zinc-500')} />

                <div className="flex-1 min-w-0">
                  {/* Name + badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {renamingId === b.id ? (
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(b); if (e.key === 'Escape') setRenamingId(null) }}
                        onBlur={() => void handleRename(b)}
                        autoFocus
                        className="text-sm font-medium bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-100 font-mono"
                      />
                    ) : (
                      <span className="text-sm font-medium text-zinc-100 font-mono truncate">{b.name}</span>
                    )}
                    {b.is_default && (
                      <span className="text-[9px] uppercase tracking-wide text-blue-300 bg-blue-500/15 border border-blue-500/30 rounded px-1.5 py-0.5">default</span>
                    )}
                    {b.is_locked && (
                      <span className="text-[9px] uppercase tracking-wide text-zinc-400 border border-zinc-700 rounded px-1.5 py-0.5 flex items-center gap-1"><Lock className="h-2.5 w-2.5" />locked</span>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 flex-wrap">
                    {b.parent_branch_id && nameById[b.parent_branch_id] && (
                      <span>forked from <span className="text-zinc-400 font-mono">{nameById[b.parent_branch_id]}</span></span>
                    )}
                    <span>{formatDate(b.created_at)}</span>
                    <span>{b.keyCount} keys · {b.localeCount} locales</span>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2 mt-2 max-w-xs">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${b.approvedPercent}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-500 tabular-nums w-8 text-right">{b.approvedPercent}%</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link href={`/${project.id}/editor?branch=${b.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100" title="Open in editor">
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </Button>
                  </Link>
                  {canManage && !b.is_default && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-blue-400" title={`Merge into ${defaultBranch?.name ?? 'main'}`} onClick={() => setMergeSource(b)}>
                        <GitMerge className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-amber-400" title="Set as default" onClick={() => void handleSetDefault(b)} disabled={busy}>
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-200" title="Rename" onClick={() => { setRenamingId(b.id); setRenameValue(b.name) }} disabled={busy}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" title="Delete" onClick={() => void handleDelete(b)} disabled={busy}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {b.is_default && (
                    <span className="text-[10px] text-zinc-600 flex items-center gap-1 px-2"><Check className="h-3 w-3" />main</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Merge dialog — merges the chosen branch into the default branch */}
      {mergeSource && defaultBranch && (
        <MergeDialog
          projectId={project.id}
          sourceBranch={mergeSource}
          targetBranch={defaultBranch}
          onClose={() => setMergeSource(null)}
          onMerged={() => { setMergeSource(null); router.refresh() }}
        />
      )}
    </div>
  )
}
