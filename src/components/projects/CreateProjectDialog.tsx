'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocaleCombobox } from '@/components/ui/LocaleCombobox'
import type { LocaleOption } from '@/app/api/locales-list/route'

export function CreateProjectDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseLocale, setBaseLocale] = useState('en')
  const [baseLocaleName, setBaseLocaleName] = useState('English')
  const [error, setError] = useState<string | null>(null)

  function handleLocaleChange(code: string, locale: LocaleOption) {
    setBaseLocale(code)
    setBaseLocaleName(locale.name)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, baseLocale, baseLocaleName }),
      })
      const json = await res.json() as { data?: { id: string }; error?: string }

      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create project')
        return
      }

      setOpen(false)
      setName('')
      setDescription('')
      setBaseLocale('en')
      setBaseLocaleName('English')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">New Project</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create a new localization project
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name" className="text-zinc-300">Project name</Label>
            <Input
              id="proj-name"
              placeholder="e.g. My Mobile App"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-blue-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc" className="text-zinc-300">
              Description <span className="text-zinc-500 font-normal">(optional)</span>
            </Label>
            <Input
              id="proj-desc"
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-blue-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300">Base language</Label>
            <LocaleCombobox
              value={baseLocale}
              onChange={handleLocaleChange}
              placeholder="Select base language…"
            />
            <p className="text-[11px] text-zinc-600">This is your source language — all other languages are translated from it.</p>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
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
