'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocaleCombobox } from '@/components/ui/LocaleCombobox'
import type { LocaleOption } from '@/app/api/locales-list/route'

interface TargetLocale { code: string; name: string; flag: string }

interface Props {
  children?: React.ReactNode
  orgId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateProjectDialog({ children, orgId, open, onOpenChange }: Props) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseLocale, setBaseLocale] = useState('en')
  const [baseLocaleName, setBaseLocaleName] = useState('English')
  const [targetLocales, setTargetLocales] = useState<TargetLocale[]>([])
  const [addingCode, setAddingCode] = useState('')
  const [addingLocale, setAddingLocale] = useState<LocaleOption | null>(null)
  const [error, setError] = useState<string | null>(null)
  const actualOpen = open ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  function handleBaseLocaleChange(code: string, locale: LocaleOption) {
    setBaseLocale(code)
    setBaseLocaleName(locale.name)
    // remove from targets if was there
    setTargetLocales((prev) => prev.filter((l) => l.code !== code))
  }

  function handleAddTarget() {
    if (!addingCode || !addingLocale) return
    if (targetLocales.some((l) => l.code === addingCode)) return
    setTargetLocales((prev) => [...prev, { code: addingCode, name: addingLocale.name, flag: addingLocale.flag }])
    setAddingCode('')
    setAddingLocale(null)
  }

  function removeTarget(code: string) {
    setTargetLocales((prev) => prev.filter((l) => l.code !== code))
  }

  function resetForm() {
    setName('')
    setDescription('')
    setBaseLocale('en')
    setBaseLocaleName('English')
    setTargetLocales([])
    setAddingCode('')
    setAddingLocale(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, name, description, baseLocale, baseLocaleName }),
      })
      const json = await res.json() as { data?: { id: string }; error?: string }

      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create project')
        return
      }

      const projectId = json.data?.id
      if (projectId && targetLocales.length > 0) {
        await fetch(`/api/projects/${projectId}/locales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locales: targetLocales.map((l) => ({ code: l.code, name: l.name })) }),
        })
      }

      setOpen(false)
      resetForm()
      router.refresh()
    })
  }

  const usedCodes = new Set([baseLocale, ...targetLocales.map((l) => l.code)])

  return (
    <Dialog open={actualOpen} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      {children}
      <DialogContent className="bg-card border-border text-card-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Project</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new localization project
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name" className="text-foreground">Project name</Label>
            <Input
              id="proj-name"
              placeholder="e.g. My Mobile App"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-blue-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc" className="text-foreground">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="proj-desc"
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-blue-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Base language</Label>
            <LocaleCombobox
              value={baseLocale}
              onChange={handleBaseLocaleChange}
              placeholder="Select base language…"
            />
            <p className="text-[11px] text-muted-foreground">Source language — all other languages are translated from it.</p>
          </div>

          {/* Target languages */}
          <div className="space-y-2">
            <Label className="text-foreground">
              Target languages <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>

            {targetLocales.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {targetLocales.map((l) => (
                  <span
                    key={l.code}
                    className="inline-flex items-center gap-1 text-xs bg-muted text-foreground border border-border rounded px-2 py-0.5"
                  >
                    {l.flag} {l.name}
                    <button
                      type="button"
                      onClick={() => removeTarget(l.code)}
                      className="text-muted-foreground hover:text-foreground ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1">
                <LocaleCombobox
                  value={addingCode}
                  onChange={(code, locale) => { setAddingCode(code); setAddingLocale(locale) }}
                  placeholder="Add a language…"
                  excludeCodes={usedCodes}
                />
              </div>
              <Button
                type="button"
                onClick={handleAddTarget}
                disabled={!addingCode || usedCodes.has(addingCode)}
                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground flex-shrink-0"
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); resetForm() }}
              className="border-border text-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isPending ? 'Creating...' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
