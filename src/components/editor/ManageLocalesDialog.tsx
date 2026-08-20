'use client'

import { useState } from 'react'
import { Plus, X, Languages, Star, Check, Loader2, Pencil } from 'lucide-react'
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
import { normalizeLocaleCode } from '@/lib/locale-code'
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
  // Rows mid-delete. They stay on screen with a spinner until the server
  // agrees: removing them first left nothing to attach the pending state to,
  // so a slow delete looked instant and a failed one made the row reappear
  // seconds later out of nowhere.
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [bulkRemoving, setBulkRemoving] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  // Which language is having its code rewritten, and the code being typed.
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null)
  const [codeDraft, setCodeDraft] = useState('')

  // Sync from props when dialog opens
  function handleOpenChange(next: boolean) {
    if (next) setLocales(project.locales)
    setPendingAction(null)
    setStaged([])
    setSelectedForRemoval(new Set())
    setConfirmBulkRemove(false)
    setRemovingIds(new Set())
    setBulkRemoving(false)
    setEditingCodeId(null)
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
      // The list is local state, so it has to be told; a router.refresh alone
      // left the dialog showing the old languages until it was reopened.
      const json = await res.json().catch(() => ({})) as { locales?: LocaleItem[] }
      if (json.locales?.length) {
        setLocales((prev) => [...prev, ...json.locales!])
      }
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
    if (targets.length === 0 || bulkRemoving) return
    setBulkRemoving(true)
    setRemovingIds(new Set(targets.map((l) => l.id)))

    // No bulk delete endpoint, and each removal drops that locale's
    // translations, so they go one at a time. Each row clears as the server
    // confirms it rather than all of them vanishing up front.
    const failed: string[] = []
    for (const locale of targets) {
      const res = await fetch(`/api/projects/${project.id}/locales/${locale.id}`, { method: 'DELETE' })
      if (res.ok) {
        setLocales((prev) => prev.filter((l) => l.id !== locale.id))
      } else {
        failed.push(locale.name)
      }
      setRemovingIds((prev) => { const next = new Set(prev); next.delete(locale.id); return next })
    }

    setSelectedForRemoval(new Set())
    setBulkRemoving(false)
    setConfirmBulkRemove(false)
    if (failed.length > 0) toast.error(`Failed to remove ${failed.join(', ')}`)
    else {
      toast.success(targets.length === 1
        ? `Removed ${targets[0]!.name}`
        : `Removed ${targets.length} languages`)
    }
    onLocalesChanged()
    router.refresh()
  }

  async function handleRemove(localeId: string, localeName: string) {
    setPendingAction(null)
    setRemovingIds((prev) => new Set(prev).add(localeId))
    const res = await fetch(`/api/projects/${project.id}/locales/${localeId}`, { method: 'DELETE' })
    setRemovingIds((prev) => { const next = new Set(prev); next.delete(localeId); return next })

    if (res.ok) {
      setLocales((prev) => prev.filter((l) => l.id !== localeId))
      toast.success(`Removed ${localeName}`)
      onLocalesChanged()
      router.refresh() // background sync
    } else {
      // The row never left, so a failure needs no restore — just say why.
      const json = await res.json().catch(() => ({})) as { error?: string }
      toast.error(json.error ?? 'Failed to remove language')
    }
  }

  /**
   * Rewrite a language's code — `en` becomes `en-US` once a project starts
   * tracking a second English, or a code was simply mistyped. Translations are
   * attached to the language's id, so nothing moves with it.
   */
  async function handleUpdateCode(localeId: string) {
    const code = normalizeLocaleCode(codeDraft)
    if (!code) return
    const res = await fetch(`/api/projects/${project.id}/locales/${localeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const json = await res.json().catch(() => ({})) as { error?: string }

    if (res.ok) {
      setLocales((prev) => prev.map((l) => l.id === localeId ? { ...l, code } : l))
      setEditingCodeId(null)
      toast.success(`Code changed to ${code}`)
      onLocalesChanged()
      router.refresh()
    } else {
      toast.error(json.error ?? 'Failed to change the code')
    }
  }

  async function handleSetBase(localeId: string, localeName: string) {
    if (busy) return
    setPendingAction(null)
    setBusy(localeId)
    // The flip waits for the server, like removal does. Flipping first meant
    // the badge moved instantly and then jumped back on failure, and there was
    // nowhere to show that anything was happening in between.
    const res = await fetch(`/api/projects/${project.id}/locales/${localeId}`, { method: 'PATCH' })
    setBusy(null)

    if (res.ok) {
      setLocales((prev) => prev.map((l) => ({ ...l, is_base: l.id === localeId })))
      toast.success(`${localeName} is now the base language`)
      onLocalesChanged()
      router.refresh() // background sync
    } else {
      const json = await res.json().catch(() => ({})) as { error?: string }
      toast.error(json.error ?? 'Failed to change base language')
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
      <DialogContent className="bg-card border-border text-foreground sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-foreground text-base">Manage Languages</DialogTitle>
        </DialogHeader>

        {selectedForRemoval.size > 0 && (
          <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 px-2.5 py-2">
            <span className="flex-1 text-xs text-foreground">
              {selectedForRemoval.size} selected
            </span>
            {bulkRemoving ? (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Removing…
              </span>
            ) : confirmBulkRemove ? (
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
            const isEditingCode = editingCodeId === locale.id
            const draftCode = normalizeLocaleCode(codeDraft)
            // Refuse a code the project already uses elsewhere before the
            // unique constraint does, and refuse a no-op save.
            const draftTaken = !!draftCode && locales.some((l) => l.id !== locale.id && l.code === draftCode)
            const canSaveCode = !!draftCode && !draftTaken && draftCode !== locale.code
            const percent = localePercent?.get(locale.id) ?? locale.percent
            const approved = localeApproved?.get(locale.id) ?? locale.approved
            const total = totalKeys ?? locale.total
            const percentColor =
              percent >= 80 ? 'text-emerald-500' :
              percent >= 50 ? 'text-amber-500' : 'text-muted-foreground'

            return (
              <div
                key={locale.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded px-1 py-2 hover:bg-muted/50',
                  (removingIds.has(locale.id) || busy === locale.id) && 'opacity-60'
                )}
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
                      disabled={removingIds.has(locale.id)}
                      aria-label={`Select ${locale.name} for removal`}
                      className="h-3.5 w-3.5 flex-shrink-0 rounded border-border"
                    />
                  )}
                  <span className="text-base w-6 text-center flex-shrink-0">{localeFlag(locale.code)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm text-foreground">{locale.name}</span>
                      {isEditingCode ? (
                        <input
                          value={codeDraft}
                          autoFocus
                          onChange={(e) => setCodeDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canSaveCode) void handleUpdateCode(locale.id)
                            if (e.key === 'Escape') setEditingCodeId(null)
                          }}
                          aria-label={`Language code for ${locale.name}`}
                          aria-invalid={!!codeDraft && !draftCode}
                          className="h-6 w-20 flex-shrink-0 rounded border border-border bg-muted px-1.5 font-mono text-[11px] text-foreground"
                        />
                      ) : (
                        <span className="flex-shrink-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground">{locale.code}</span>
                      )}
                      {locale.is_base && (
                        <span className="text-[10px] text-muted-foreground border border-border rounded px-1 flex-shrink-0">base</span>
                      )}
                    </div>
                    {isEditingCode && codeDraft && !draftCode ? (
                      <span className="text-[11px] text-destructive">Use a code like &quot;ms&quot; or &quot;en-CA&quot;</span>
                    ) : isEditingCode && draftTaken ? (
                      <span className="text-[11px] text-destructive">{draftCode} is already in this project</span>
                    ) : (
                      <span
                        className={cn('text-[11px] tabular-nums', percentColor)}
                        title={`${approved} of ${total} keys approved`}
                      >
                        {percent}% complete
                      </span>
                    )}
                  </div>
                </div>

                {removingIds.has(locale.id) ? (
                  <div className="flex flex-shrink-0 items-center gap-1 px-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label={`Removing ${locale.name}`} />
                  </div>
                ) : isEditingCode ? (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <LoadingButton
                      size="sm"
                      disabled={!canSaveCode}
                      className="h-6 px-2 text-[11px] bg-blue-600 text-white hover:bg-blue-500"
                      onClick={() => handleUpdateCode(locale.id)}
                      loadingText="Saving…"
                    >
                      Save
                    </LoadingButton>
                    <button
                      onClick={() => setEditingCodeId(null)}
                      className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : isPending ? (
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
                    <button
                      onClick={() => { setPendingAction(null); setCodeDraft(locale.code); setEditingCodeId(locale.id) }}
                      disabled={!!busy}
                      title="Change language code"
                      aria-label={`Change the code for ${locale.name}`}
                      className="p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!locale.is_base && (
                      <button
                        onClick={() => setPendingAction({ id: locale.id, kind: 'setBase' })}
                        disabled={!!busy}
                        title="Set as base language"
                        aria-label={busy === locale.id ? `Setting ${locale.name} as base language` : `Set ${locale.name} as base language`}
                        className="p-1 text-muted-foreground transition-colors hover:text-blue-500 disabled:opacity-40"
                      >
                        {busy === locale.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Star className="h-3.5 w-3.5" />}
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
