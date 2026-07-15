'use client'

import { useState } from 'react'
import { Plus, X, Languages } from 'lucide-react'
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

interface Props {
  project: ProjectWithStats
  onLocalesChanged: () => void
}

type LocaleItem = ProjectWithStats['locales'][number]

export function ManageLocalesDialog({ project, onLocalesChanged }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [locales, setLocales] = useState<LocaleItem[]>(project.locales)
  const [addingCode, setAddingCode] = useState('')
  const [addingLocale, setAddingLocale] = useState<LocaleOption | null>(null)
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  // Sync from props when dialog opens
  function handleOpenChange(next: boolean) {
    if (next) setLocales(project.locales)
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
    if (!confirm(`Remove "${localeName}"? All its translations will be deleted.`)) return
    setRemoving(localeId)
    // Optimistic update — remove immediately
    setLocales((prev) => prev.filter((l) => l.id !== localeId))
    const res = await fetch(`/api/projects/${project.id}/locales/${localeId}`, { method: 'DELETE' })
    setRemoving(null)
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
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {locales.map((locale) => (
            <div
              key={locale.id}
              className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/50"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base w-6 text-center">{localeFlag(locale.code)}</span>
                <div>
                  <span className="text-sm text-foreground">{locale.name}</span>
                  <span className="text-[11px] text-muted-foreground font-mono ml-1.5">{locale.code}</span>
                </div>
                {locale.is_base && (
                  <span className="text-[10px] text-muted-foreground border border-border rounded px-1">base</span>
                )}
              </div>
              {!locale.is_base && (
                <button
                  onClick={() => handleRemove(locale.id, locale.name)}
                  disabled={removing === locale.id}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
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
