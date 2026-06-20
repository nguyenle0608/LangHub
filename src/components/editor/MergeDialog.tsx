'use client'

import { useState, useEffect, useCallback } from 'react'
import { GitMerge, Loader2, AlertTriangle, Check, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Branch } from '@/lib/branches/queries'

type Cell = { value: string | null; status: string | null }
type Conflict = {
  keyName: string
  localeCode: string
  base: Cell | null
  ours: Cell | null
  theirs: Cell | null
}
type Auto = {
  keyName: string
  localeCode: string
  value: string | null
  status: string | null
  ours: Cell | null
}
type Side = 'ours' | 'theirs'

interface Props {
  projectId: string
  sourceBranch: Branch
  targetBranch: Branch
  onClose: () => void
  onMerged: (opts: { deletedSourceId?: string }) => void
}

function CellText({ value }: { value: string | null | undefined }) {
  return value
    ? <span className="text-zinc-200 whitespace-pre-wrap break-words">{value}</span>
    : <span className="text-zinc-600 italic">empty</span>
}

export function MergeDialog({ projectId, sourceBranch, targetBranch, onClose, onMerged }: Props) {
  const [loading, setLoading] = useState(true)
  const [auto, setAuto] = useState<Auto[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [choices, setChoices] = useState<Map<string, Side>>(new Map())
  const [deleteSource, setDeleteSource] = useState(false)
  const [merging, setMerging] = useState(false)

  const ck = (c: { keyName: string; localeCode: string }) => `${c.keyName}::${c.localeCode}`

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/branches/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, sourceBranchId: sourceBranch.id, targetBranchId: targetBranch.id }),
        })
        const json = await res.json() as { data?: { auto: Auto[]; conflicts: Conflict[] }; error?: string }
        if (cancelled) return
        if (!res.ok || !json.data) { toast.error(json.error ?? 'Failed to compute merge'); onClose(); return }
        setAuto(json.data.auto)
        setConflicts(json.data.conflicts)
        setChoices(new Map(json.data.conflicts.map((c) => [`${c.keyName}::${c.localeCode}`, 'theirs' as Side])))
      } catch {
        if (!cancelled) { toast.error('Network error'); onClose() }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [projectId, sourceBranch.id, targetBranch.id, onClose])

  const handleMerge = useCallback(async () => {
    setMerging(true)
    try {
      const resolutions = conflicts.map((c) => {
        const side = choices.get(ck(c)) ?? 'theirs'
        const cell = side === 'ours' ? c.ours : c.theirs
        return { keyName: c.keyName, localeCode: c.localeCode, value: cell?.value ?? null, status: cell?.status ?? null }
      })
      const res = await fetch('/api/branches/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, sourceBranchId: sourceBranch.id, targetBranchId: targetBranch.id,
          apply: true, deleteSource, resolutions,
        }),
      })
      const json = await res.json() as { data?: { merged: number; createdKeys?: number; deletedSource?: boolean }; error?: string }
      if (!res.ok || !json.data) { toast.error(json.error ?? 'Merge failed'); return }
      const newKeys = json.data.createdKeys ?? 0
      toast.success(
        `Merged ${json.data.merged} change${json.data.merged !== 1 ? 's' : ''} into ${targetBranch.name}` +
        (newKeys > 0 ? ` (+${newKeys} new key${newKeys !== 1 ? 's' : ''})` : '') +
        (json.data.deletedSource ? ` · deleted ${sourceBranch.name}` : '')
      )
      onMerged({ deletedSourceId: json.data.deletedSource ? sourceBranch.id : undefined })
    } catch {
      toast.error('Network error')
    } finally {
      setMerging(false)
    }
  }, [conflicts, choices, deleteSource, projectId, sourceBranch.id, sourceBranch.name, targetBranch.name, targetBranch.id, onMerged])

  const nothingToDo = !loading && auto.length === 0 && conflicts.length === 0

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl p-0 bg-zinc-950 border-zinc-800 flex flex-col max-h-[85vh]">
        <DialogHeader className="px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm text-zinc-100">
            <GitMerge className="h-4 w-4 text-blue-400" />
            Merge <span className="font-mono text-blue-300">{sourceBranch.name}</span>
            <span className="text-zinc-500">→</span>
            <span className="font-mono text-zinc-200">{targetBranch.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Computing merge…
            </div>
          ) : nothingToDo ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Check className="h-8 w-8 text-emerald-500 mb-3" />
              <p className="text-sm text-zinc-300">Already up to date</p>
              <p className="text-xs text-zinc-600 mt-1">No changes to merge from {sourceBranch.name}.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-emerald-400">{auto.length} auto-merge{auto.length !== 1 ? 's' : ''}</span>
                <span className={cn(conflicts.length > 0 ? 'text-amber-400' : 'text-zinc-600')}>
                  {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Conflicts — pick a side */}
              {conflicts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Pick which side wins for each conflicting cell.
                  </div>
                  {conflicts.map((c) => {
                    const key = ck(c)
                    const choice = choices.get(key) ?? 'theirs'
                    return (
                      <div key={key} className="border border-zinc-800 rounded-lg overflow-hidden">
                        <div className="px-3 py-1.5 bg-zinc-900/60 border-b border-zinc-800 flex items-center gap-2">
                          <span className="font-mono text-[11px] text-zinc-300 truncate">{c.keyName}</span>
                          <span className="text-[10px] text-zinc-600 uppercase">{c.localeCode}</span>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-zinc-800">
                          {(['ours', 'theirs'] as Side[]).map((side) => {
                            const cell = side === 'ours' ? c.ours : c.theirs
                            const label = side === 'ours' ? targetBranch.name : sourceBranch.name
                            const selected = choice === side
                            return (
                              <button
                                key={side}
                                onClick={() => setChoices((prev) => new Map(prev).set(key, side))}
                                className={cn('text-left p-3 transition-colors text-xs', selected ? 'bg-blue-500/10' : 'hover:bg-zinc-900/50')}
                              >
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <span className={cn('h-3 w-3 rounded-full border flex items-center justify-center', selected ? 'border-blue-400 bg-blue-400' : 'border-zinc-600')}>
                                    {selected && <Check className="h-2 w-2 text-zinc-950" />}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
                                </div>
                                <p className="line-clamp-4"><CellText value={cell?.value} /></p>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Auto-merge overview — what will change in target with no conflict */}
              {auto.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                    Changes applied to {targetBranch.name}
                  </p>
                  <div className="border border-zinc-800 rounded-lg divide-y divide-zinc-800/60 overflow-hidden">
                    {auto.map((a) => (
                      <div key={ck(a)} className="px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[11px] text-zinc-400 truncate">{a.keyName}</span>
                          <span className="text-[10px] text-zinc-600 uppercase">{a.localeCode}</span>
                        </div>
                        <div className="flex items-start gap-2 text-[11px]">
                          <span className="flex-1 min-w-0 line-clamp-2 text-zinc-500 line-through decoration-zinc-700"><CellText value={a.ours?.value} /></span>
                          <ArrowRight className="h-3 w-3 text-zinc-600 flex-shrink-0 mt-0.5" />
                          <span className="flex-1 min-w-0 line-clamp-2"><CellText value={a.value} /></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between gap-2 flex-shrink-0">
          {!sourceBranch.is_default ? (
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteSource}
                onChange={(e) => setDeleteSource(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 accent-blue-500"
              />
              Delete <span className="font-mono text-zinc-300">{sourceBranch.name}</span> after merge
            </label>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={merging}>Cancel</Button>
            <Button size="sm" className="gap-1.5" disabled={loading || merging || nothingToDo} onClick={handleMerge}>
              {merging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
              {conflicts.length > 0 ? 'Resolve & merge' : 'Merge'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
