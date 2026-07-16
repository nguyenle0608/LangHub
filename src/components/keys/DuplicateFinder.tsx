'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, GitMerge, Link2, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DuplicateGroup } from '@/lib/supabase/queries/keys'
import type { ProjectWithStats } from '@/types'

interface Props {
  project: ProjectWithStats
  initialGroups: DuplicateGroup[]
}

type GroupState = {
  parentKeyId: string | null
  // per-child action: 'merge' | 'link' | 'keep'
  childActions: Record<string, 'merge' | 'link' | 'keep'>
}

export function DuplicateFinder({ project, initialGroups }: Props) {
  const [groups, setGroups] = useState(initialGroups)
  const [groupStates, setGroupStates] = useState<Record<number, GroupState>>(() =>
    Object.fromEntries(
      initialGroups.map((g, i) => [
        i,
        {
          parentKeyId: g.keys[0]?.id ?? null,
          childActions: Object.fromEntries(
            g.keys.slice(1).map((k) => [k.id, 'merge' as const])
          ),
        },
      ])
    )
  )
  const [expanded, setExpanded] = useState<Set<number>>(new Set(initialGroups.map((_, i) => i)))
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    try {
      const resp = await fetch(`/api/duplicates?projectId=${project.id}`)
      const data = await resp.json() as { data?: DuplicateGroup[] }
      const newGroups = data.data ?? []
      setGroups(newGroups)
      setGroupStates(
        Object.fromEntries(
          newGroups.map((g, i) => [
            i,
            {
              parentKeyId: g.keys[0]?.id ?? null,
              childActions: Object.fromEntries(
                g.keys.slice(1).map((k) => [k.id, 'merge' as const])
              ),
            },
          ])
        )
      )
      setExpanded(new Set(newGroups.map((_, i) => i)))
    } catch {
      toast.error('Failed to refresh')
    } finally {
      setRefreshing(false)
    }
  }

  const handleMergeGroup = async (groupIdx: number) => {
    const group = groups[groupIdx]
    const state = groupStates[groupIdx]
    if (!group || !state?.parentKeyId) return

    const toMerge = Object.entries(state.childActions)
      .filter(([, action]) => action === 'merge')
      .map(([id]) => id)

    const toLink = Object.entries(state.childActions)
      .filter(([, action]) => action === 'link')
      .map(([id]) => id)

    setLoading((prev) => ({ ...prev, [groupIdx]: true }))
    try {
      if (toMerge.length > 0) {
        const resp = await fetch('/api/duplicates?action=merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            parentKeyId: state.parentKeyId,
            childKeyIds: toMerge,
          }),
        })
        if (!resp.ok) { toast.error('Merge failed'); return }
      }

      for (const childId of toLink) {
        await fetch('/api/duplicates?action=link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentKeyId: state.parentKeyId, childKeyId: childId }),
        })
      }

      const parentKey = group.keys.find((k) => k.id === state.parentKeyId)
      toast.success(`Resolved group for "${parentKey?.key ?? ''}"`)
      await refresh()
    } catch {
      toast.error('Network error')
    } finally {
      setLoading((prev) => ({ ...prev, [groupIdx]: false }))
    }
  }

  const totalSavings = groups.reduce((sum, g) => sum + (g.keys.length - 1), 0)

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Nav */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <Link
          href={`/dashboard/${project.id}/editor`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-muted-foreground text-sm">{project.name}</span>
        <span className="text-border text-sm">/</span>
        <span className="text-sm font-medium text-foreground">Duplicate Keys</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-border h-7 text-xs gap-1.5"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className={['h-3 w-3', refreshing ? 'animate-spin' : ''].join(' ')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Banner */}
        {groups.length > 0 ? (
          <div className="mx-6 mt-5 mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-300">
                {groups.length} duplicate group{groups.length > 1 ? 's' : ''} found
              </p>
              <p className="text-xs text-yellow-400/70 mt-0.5">
                Resolving all groups could save ~{totalSavings} redundant translation{totalSavings > 1 ? 's' : ''} per locale.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-6 mt-10 text-center">
            <div className="text-muted-foreground text-sm">No duplicate keys found.</div>
            <p className="text-xs text-muted-foreground mt-1">All keys have unique base-locale values.</p>
          </div>
        )}

        {/* Strategy legend */}
        {groups.length > 0 && (
          <div className="mx-6 mb-5 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><GitMerge className="h-3.5 w-3.5 text-destructive" /><span className="text-foreground">Merge</span> — delete child, keep parent</span>
            <span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5 text-blue-400" /><span className="text-foreground">Link</span> — keep both, reference parent</span>
            <span className="flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground">Keep</span> — do nothing</span>
          </div>
        )}

        {/* Groups */}
        <div className="mx-6 space-y-3 pb-10">
          {groups.map((group, i) => {
            const state = groupStates[i]
            const isExpanded = expanded.has(i)

            return (
              <div key={i} className="rounded-lg border border-border bg-card/40 overflow-hidden">
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => {
                    const next = new Set(prev)
                    if (next.has(i)) next.delete(i)
                    else next.add(i)
                    return next
                  })}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  <div className="flex-1 text-left">
                    <span className="text-sm text-foreground font-medium">
                      &quot;{group.baseValue.length > 60 ? group.baseValue.slice(0, 60) + '…' : group.baseValue}&quot;
                    </span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {group.localeCode.toUpperCase()} · {group.keys.length} keys
                    </span>
                  </div>
                  <Badge variant="outline" className="text-yellow-400 border-yellow-500/40 text-[10px]">
                    {group.keys.length - 1} duplicate{group.keys.length > 2 ? 's' : ''}
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                    {group.keys.map((key, keyIdx) => {
                      const isParent = state?.parentKeyId === key.id
                      const childAction = keyIdx > 0 ? (state?.childActions[key.id] ?? 'merge') : null

                      return (
                        <div
                          key={key.id}
                          className={[
                            'flex items-center gap-3 rounded-md px-3 py-2.5 border transition-colors',
                            isParent
                              ? 'border-blue-500/40 bg-blue-500/5'
                              : 'border-border/60 bg-card/60',
                          ].join(' ')}
                        >
                          {/* Parent radio */}
                          <button
                            type="button"
                            onClick={() =>
                              setGroupStates((prev) => {
                                const g = prev[i]
                                if (!g) return prev
                                // Move old parent to first child action
                                const newChildActions = { ...g.childActions }
                                // If this key was a child, remove from childActions
                                delete newChildActions[key.id]
                                // Add old parent to childActions if it was a non-initial key
                                if (g.parentKeyId && g.parentKeyId !== key.id) {
                                  newChildActions[g.parentKeyId] = 'merge'
                                }
                                return { ...prev, [i]: { parentKeyId: key.id, childActions: newChildActions } }
                              })
                            }
                            className={[
                              'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors',
                              isParent ? 'border-blue-500 bg-blue-500' : 'border-border hover:border-zinc-400',
                            ].join(' ')}
                          />

                          <div className="flex-1 min-w-0">
                            <span className="font-mono text-sm text-foreground truncate block">{key.key}</span>
                            {key.description && (
                              <span className="text-[11px] text-muted-foreground truncate block">{key.description}</span>
                            )}
                          </div>

                          {isParent && (
                            <span className="text-[10px] text-blue-300 font-medium px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30">
                              PARENT
                            </span>
                          )}

                          {childAction && (
                            <div className="flex gap-1">
                              {(['merge', 'link', 'keep'] as const).map((action) => (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() =>
                                    setGroupStates((prev) => {
                                      const g = prev[i]
                                      if (!g) return prev
                                      return { ...prev, [i]: { ...g, childActions: { ...g.childActions, [key.id]: action } } }
                                    })
                                  }
                                  className={[
                                    'text-[10px] px-2 py-0.5 rounded border transition-colors capitalize',
                                    childAction === action
                                      ? action === 'merge'
                                        ? 'bg-red-500/20 border-red-500/50 text-red-300'
                                        : action === 'link'
                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                        : 'bg-accent border-border text-foreground'
                                      : 'border-border text-muted-foreground hover:border-zinc-500',
                                  ].join(' ')}
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        onClick={() => handleMergeGroup(i)}
                        disabled={loading[i] ?? false}
                        className="text-xs h-7"
                      >
                        {loading[i] ? 'Processing…' : 'Resolve Group'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
