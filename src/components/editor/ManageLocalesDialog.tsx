'use client'

import { useState } from 'react'
import { Plus, X, Languages, Star, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
  const [addingCode, setAddingCode] = useState('')
  const [addingLocale, setAddingLocale] = useState<LocaleOption | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  // Sync from props when dialog opens
  function handleOpenChange(next: boolean) {
    if (next) setLocales(project.locales)
    setPendingAction(null)
    setOpen(next)
  }

  const existingCodes = new Set(locales.map((l) => l.code))

  async function handleAdd() {
    if (!addingCode || !addingLocale) return
    setLoading(true)
    const res = await fetch(`/api/projects/${project.id}/locales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: addingCode, name: addingLocale.name }),
    })
    setLoading(false)
    if (res.ok) {
      const json = await res.json() as { locale?: LocaleItem }
      // Optimistic update — list reflects immediately
      if (json.locale) {
        setLocales((prev) => [...prev, json.locale!])
      }
      toast.success(`Added ${addingLocale.name}`)
      setAddingCode('')
      setAddingLocale(null)
      onLocalesChanged()
      router.refresh() // background sync, don't await
    } else {
      const json = await res.json() as { error?: string }
      toast.error(json.error ?? 'Failed to add language')
    }
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

        {/* Add language */}
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Add language</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <LocaleCombobox
                value={addingCode}
                onChange={(code, locale) => { setAddingCode(code); setAddingLocale(locale) }}
                placeholder="Search language…"
                excludeCodes={existingCodes}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={!addingCode || loading}
              className="bg-blue-600 hover:bg-blue-500 text-white flex-shrink-0"
              size="sm"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
