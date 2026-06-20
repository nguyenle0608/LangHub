'use client'

import { useState } from 'react'
import { GitBranch, Plus, Check, Trash2, Loader2, GitMerge } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Branch } from '@/lib/branches/queries'

interface Props {
  projectId: string
  branches: Branch[]
  activeBranchId: string
  canManage: boolean
  switching: boolean
  onSwitch: (branchId: string) => void
  onBranchCreated: (branch: Branch) => void
  onBranchDeleted: (branchId: string) => void
  onMerge?: (sourceBranchId: string) => void
}

export function BranchSwitcher({
  projectId,
  branches,
  activeBranchId,
  canManage,
  switching,
  onSwitch,
  onBranchCreated,
  onBranchDeleted,
  onMerge,
}: Props) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const active = branches.find((b) => b.id === activeBranchId)

  function switchTo(branchId: string) {
    setOpen(false)
    if (branchId !== activeBranchId) onSwitch(branchId)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, name, sourceBranchId: activeBranchId }),
      })
      const json = await res.json() as { data?: Branch; error?: string }
      if (!res.ok || !json.data) { toast.error(json.error ?? 'Failed to create branch'); return }
      toast.success(`Branch "${name}" created from ${active?.name ?? 'main'}`)
      setNewName('')
      setCreating(false)
      setOpen(false)
      onBranchCreated(json.data)
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(branch: Branch, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete branch "${branch.name}"? This removes its translations and cannot be undone.`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/branches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, branchId: branch.id }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) { toast.error(json.error ?? 'Failed to delete'); return }
      toast.success(`Deleted "${branch.name}"`)
      onBranchDeleted(branch.id)
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-zinc-300 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700"
          title="Switch branch"
        >
          {switching
            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
            : <GitBranch className="h-3.5 w-3.5 text-zinc-400" />}
          <span className="font-medium max-w-[140px] truncate">{active?.name ?? 'main'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1 bg-zinc-900 border-zinc-800" align="start">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 px-2 py-1.5">Branches</p>

        <div className="max-h-64 overflow-y-auto">
          {branches.map((b) => {
            const isActive = b.id === activeBranchId
            return (
              <div
                key={b.id}
                onClick={() => switchTo(b.id)}
                className={cn(
                  'group w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs border-l-2',
                  isActive
                    ? 'bg-blue-500/15 text-zinc-100 border-blue-500'
                    : 'text-zinc-300 hover:bg-zinc-800/60 border-transparent'
                )}
              >
                <GitBranch className={cn('h-3.5 w-3.5 flex-shrink-0', isActive ? 'text-blue-400' : 'text-zinc-500')} />
                <span className="flex-1 truncate font-medium">{b.name}</span>
                {b.is_default && (
                  <span className="text-[9px] uppercase tracking-wide text-zinc-500 border border-zinc-700 rounded px-1">main</span>
                )}
                {isActive && <Check className="h-3 w-3 text-blue-400 flex-shrink-0" />}
                {canManage && !isActive && onMerge && !b.is_default && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpen(false); onMerge(b.id) }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-blue-400 transition-colors"
                    title={`Merge "${b.name}" into current`}
                  >
                    <GitMerge className="h-3 w-3" />
                  </button>
                )}
                {canManage && !b.is_default && (
                  <button
                    onClick={(e) => handleDelete(b, e)}
                    disabled={busy}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-colors"
                    title="Delete branch"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {canManage && (
          <>
            <div className="border-t border-zinc-800 my-1" />
            {creating ? (
              <form onSubmit={handleCreate} className="p-1.5 space-y-1.5">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="branch name"
                  autoFocus
                  className="h-7 text-xs bg-zinc-800 border-zinc-700"
                />
                <p className="text-[10px] text-zinc-600 px-0.5">
                  Forks from <span className="text-zinc-400">{active?.name ?? 'main'}</span>
                </p>
                <div className="flex gap-1.5">
                  <Button type="submit" size="sm" disabled={busy || !newName.trim()} className="h-6 text-xs flex-1">
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setCreating(false); setNewName('') }}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full text-left text-xs text-zinc-300 hover:text-zinc-100 px-2 py-1.5 rounded hover:bg-zinc-800/60 flex items-center gap-2"
              >
                <Plus className="h-3.5 w-3.5 text-zinc-500" />
                New branch
              </button>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
