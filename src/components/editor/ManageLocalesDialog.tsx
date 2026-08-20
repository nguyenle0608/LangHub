'use client'

import { useState } from 'react'
import { Plus, X, Languages, Star, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { LocaleCombobox } from '@/components/ui/LocaleCombobox'
import type { LocaleOption } from '@/app/api/locales-list/route'
import type { ProjectWithStats } from '@/types'
import { localeFlag } from '@/lib/locale-flag'
import { cn } from '@/lib/utils'

interface Props {
  project: ProjectWithStats
  onLocalesChanged: () => void
  // Live client-side stats (from the editor's current key/translation state) —
  // preferred over `project.locales[].percent`, which is only as fresh as the
  // last full page load/refresh and drifts as soon as the user approves or
  // edits translations without a hard reload.
  totalKeys?: number
  localeApproved?: Map<string, number>
  localePercent?: Map<string, number>
}

type LocaleItem = ProjectWithStats['locales'][number]
type PendingAction = { id: string; kind: 'remove' | 'setBase' }

export function ManageLocalesDialog({ project, onLocalesChanged, totalKeys, localeApproved, localePercent }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [locales, setLocales] = useState<LocaleItem[]>(project.locales)
  // Staged before committing, so several languages go in on one round trip and
  // several go out behind one confirmation.
  const [staged, setStaged] = useState<LocaleOption[]>([])
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set())
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  // Sync from props when dialog opens
  function handleOpenChange(next: boolean) {
    if (next) setLocales(project.locales)
    setPendingAction(null)
    setStaged([])
    setSelectedForRemoval(new Set())
    setConfirmBulkRemove(false)
    setOpen(next)
  }

  const existingCodes = new Set(locales.map((l) => l.code))

  const stagedCodes = new Set(staged.map((l) => l.code))

  function toggleStaged(locale: LocaleOption) {
    setStaged((prev) => prev.some((l) => l.code === locale.code)
      ? prev.filter((l) => l.code !== locale.code)
      : [...prev, locale])
  }

  async function handleAdd() {
    if (staged.length === 0) return
    // The API already accepted a bulk payload; nothing had ever sent one.
    const res = await fetch(`/api/projects/${project.id}/locales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locales: staged.map((l) => ({ code: l.code, name: l.name })) }),
    })
    if (res.ok) {
      toast.success(staged.length === 1
        ? `Added ${staged[0]!.name}`
        : `Added ${staged.length} languages`)
      setStaged([])
      onLocalesChanged()
      router.refresh()
    } else {
      const json = await res.json().catch(() => ({})) as { error?: string }
      toast.error(json.error ?? 'Failed to add languages')
    }
  }

  async function handleRemoveSelected() {
    const targets = locales.filter((l) => selectedForRemoval.has(l.id) && !l.is_base)
    if (targets.length === 0) return
    setConfirmBulkRemove(false)
    setBusy('bulk')
    setLocales((prev) => prev.filter((l) => !selectedForRemoval.has(l.id)))

    // No bulk delete endpoint, and each removal drops that locale's
    // translations, so they go one at a time and stop at the first failure
    // rather than pressing on through a broken state.
    const failed: string[] = []
    for (const locale of targets) {
      const res = await fetch(`/api/projects/${project.id}/locales/${locale.id}`, { method: 'DELETE' })
      if (!res.ok) failed.push(locale.name)
    }
    setBusy(null)
    setSelectedForRemoval(new Set())

    if (failed.length > 0) {
      setLocales(project.locales)
      toast.error(`Failed to remove ${failed.join(', ')}`)
    } else {
      toast.success(targets.length === 1
        ? `Removed ${targets[0]!.name}`
        : `Removed ${targets.length} languages`)
    }
    onLocalesChanged()
    router.refresh()
  }

  async function handleRemove(localeId: string, localeName: string) {
    setPendingAction(null)
    setBusy(localeId)
    // Optimistic update — remove immediately
    setLocales((prev) => prev.filter((l) => l.id !== localeId))
    const res = await fetch(`/api/projects/${project.id}/locales/${localeId}`, { method: 'DELETE' })
    setBusy(null)
    if (res.ok) {
      toast.success(`Removed ${localeName}`)
      onLocalesChanged()
      router.refresh() // background sync
    } else {
      // Revert on failure
      setLocales(project.locales)
      toast.error('Failed to remove language')
    }
  }

  async function handleSetBase(localeId: string, localeName: string) {
    setPendingAction(null)
    setBusy(localeId)
    // Optimistic update — flip is_base locally
    setLocales((prev) => prev.map((l) => ({ ...l, is_base: l.id === localeId })))
    const res = await fetch(`/api/projects/${project.id}/locales/${localeId}`, { method: 'PATCH' })
    setBusy(null)
    if (res.ok) {
      toast.success(`${localeName} is now the base language`)
      onLocalesChanged()
      router.refresh() // background sync
    } else {
      // Revert on failure
      setLocales(project.locales)
      toast.error('Failed to change base language')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
          <Languages className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Languages</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground text-base">Manage Languages</DialogTitle>
        </DialogHeader>

        {selectedForRemoval.size > 0 && (
          <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 px-2.5 py-2">
            <span className="flex-1 text-xs text-foreground">
              {selectedForRemoval.size} selected
            </span>
            {confirmBulkRemove ? (
              <>
                <span className="text-[11px] text-muted-foreground">Delete their translations?</span>
                <LoadingButton
                  size="sm"
                  variant="destructive"
                  className="h-6 px-2 text-[11px]"
                  onClick={handleRemoveSelected}
                  loadingText="Removing…"
                >
                  Remove
                </LoadingButton>
                <button onClick={() => setConfirmBulkRemove(false)} className="text-[11px] text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmBulkRemove(true)}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                >
                  Remove selected
                </button>
                <button onClick={() => setSelectedForRemoval(new Set())} className="text-[11px] text-muted-foreground hover:text-foreground">
                  Clear
                </button>
              </>
            )}
          </div>
        )}

        {/* Existing locales */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {locales.map((locale) => {
            const isPending = pendingAction?.id === locale.id
            const percent = localePercent?.get(locale.id) ?? locale.percent
            const approved = localeApproved?.get(locale.id) ?? locale.approved
            const total = totalKeys ?? locale.total
            const percentColor =
              percent >= 80 ? 'text-emerald-500' :
              percent >= 50 ? 'text-amber-500' : 'text-muted-foreground'

            return (
              <div
                key={locale.id}
                className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/50"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {/* The base locale cannot be deleted, so it gets no checkbox
                      rather than one that always fails. */}
                  {locale.is_base ? (
                    <span className="w-3.5 flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <input
                      type="checkbox"
                      checked={selectedForRemoval.has(locale.id)}
                      onChange={() => setSelectedForRemoval((prev) => {
                        const next = new Set(prev)
                        if (next.has(locale.id)) next.delete(locale.id); else next.add(locale.id)
                        return next
                      })}
                      aria-label={`Select ${locale.name} for removal`}
                      className="h-3.5 w-3.5 flex-shrink-0 rounded border-border"
                    />
                  )}
                  <span className="text-base w-6 text-center flex-shrink-0">{localeFlag(locale.code)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-foreground truncate">{locale.name}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">{locale.code}</span>
                      {locale.is_base && (
                        <span className="text-[10px] text-muted-foreground border border-border rounded px-1 flex-shrink-0">base</span>
                      )}
                    </div>
                    <span
                      className={cn('text-[11px] tabular-nums', percentColor)}
                      title={`${approved} of ${total} keys approved`}
                    >
                      {percent}% complete
                    </span>
                  </div>
                </div>

                {isPending ? (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      {pendingAction.kind === 'remove' ? 'Remove?' : 'Set as base?'}
                    </span>
                    <button
                      onClick={() => (
                        pendingAction.kind === 'remove'
                          ? handleRemove(locale.id, locale.name)
                          : handleSetBase(locale.id, locale.name)
                      )}
                      className={cn(
                        'text-[11px] rounded px-1.5 py-0.5 font-medium transition-colors',
                        pendingAction.kind === 'remove'
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      )}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setPendingAction(null)}
                      className="text-[11px] text-muted-foreground hover:text-foreground rounded px-1.5 py-0.5"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {!locale.is_base && (
                      <button
                        onClick={() => setPendingAction({ id: locale.id, kind: 'setBase' })}
                        disabled={busy === locale.id}
                        title="Set as base language"
                        aria-label={`Set ${locale.name} as base language`}
                        className="text-muted-foreground hover:text-blue-500 transition-colors disabled:opacity-40 p-1"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!locale.is_base && (
                      <button
                        onClick={() => setPendingAction({ id: locale.id, kind: 'remove' })}
                        disabled={busy === locale.id}
                        title="Remove language"
                        aria-label={`Remove ${locale.name}`}
                        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {locale.is_base && (
                      <Check className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add languages */}
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Add languages</p>
          {staged.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {staged.map((locale) => (
                <span key={locale.code} className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]">
                  <span>{locale.flag}</span>
                  <span className="max-w-[11rem] truncate">{locale.name}</span>
                  <button type="button" onClick={() => toggleStaged(locale)} aria-label={`Remove ${locale.name} from selection`}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <LocaleCombobox
                value=""
                multiple
                selectedCodes={stagedCodes}
                onChange={(_code, locale) => toggleStaged(locale)}
                placeholder="Search language…"
                excludeCodes={existingCodes}
              />
            </div>
            <LoadingButton
              onClick={handleAdd}
              disabled={staged.length === 0}
              className="flex-shrink-0 bg-blue-600 text-white hover:bg-blue-500"
              size="sm"
              loadingText={null}
            >
              <Plus className="h-4 w-4" />
              {staged.length > 0 && <span className="ml-1 text-xs">{staged.length}</span>}
            </LoadingButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
