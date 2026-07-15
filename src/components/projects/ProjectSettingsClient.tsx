'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Loader2 } from 'lucide-react'
import type { ProjectWithStats } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { LocaleCombobox } from '@/components/ui/LocaleCombobox'
import type { LocaleOption } from '@/app/api/locales-list/route'

export function ProjectSettingsClient({ project }: { project: ProjectWithStats }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [removingLocaleId, setRemovingLocaleId] = useState<string | null>(null)
  const [localeError, setLocaleError] = useState<string | null>(null)

  // For adding a new locale
  const [addLocaleCode, setAddLocaleCode] = useState('')
  const [addLocaleName, setAddLocaleName] = useState('')
  const [addingLocale, setAddingLocale] = useState(false)

  // Flags for existing locales loaded from API
  const [flagMap, setFlagMap] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/locales-list')
      .then((r) => r.json())
      .then((data: LocaleOption[]) => {
        const map: Record<string, string> = {}
        for (const l of data) map[l.code] = l.flag
        setFlagMap(map)
      })
      .catch(() => {})
  }, [])

  const existingLocaleCodes = new Set(project.locales.map((l) => l.code))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveMsg(null)
    startTransition(async () => {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      if (res.ok) {
        setSaveMsg('Saved')
        router.refresh()
        setTimeout(() => setSaveMsg(null), 2000)
      }
    })
  }

  async function handleAddLocale() {
    if (!addLocaleCode || !addLocaleName) return
    setLocaleError(null)
    setAddingLocale(true)
    const res = await fetch(`/api/projects/${project.id}/locales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: addLocaleCode, name: addLocaleName }),
    })
    setAddingLocale(false)
    if (!res.ok) {
      const json = await res.json() as { error?: string }
      setLocaleError(json.error ?? 'Failed to add locale')
    } else {
      setAddLocaleCode('')
      setAddLocaleName('')
      router.refresh()
    }
  }

  async function handleRemoveLocale(localeId: string, isBase: boolean | null) {
    if (isBase) return
    if (!confirm('Remove this locale? All translations for it will be deleted.')) return
    setRemovingLocaleId(localeId)
    try {
      await fetch(`/api/projects/${project.id}/locales/${localeId}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setRemovingLocaleId(null)
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== project.name || deleting) return
    setDeleting(true)
    try {
      await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      router.push('/projects')
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/projects" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            Projects
          </Link>
          <span className="text-border">/</span>
          <Link href={`/${project.id}/editor`} className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            {project.name}
          </Link>
          <span className="text-border">/</span>
          <span className="text-foreground text-sm">Settings</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* General */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">General</h2>
          <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-foreground">Project name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-muted border-border text-foreground focus-visible:ring-blue-600"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-blue-600"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {isPending ? 'Saving...' : 'Save changes'}
              </Button>
              {saveMsg && <span className="text-sm text-green-400">{saveMsg}</span>}
            </div>
          </form>
        </section>

        {/* Locales */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-1">Languages</h2>
          <p className="text-muted-foreground text-sm mb-4">Add or remove languages for this project.</p>

          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            {/* Current locales */}
            <div className="space-y-1">
              {project.locales.map((locale) => {
                const flag = flagMap[locale.code] ?? '🌐'
                const percent = locale.percent
                const percentColor =
                  percent >= 80 ? 'text-green-400' : percent >= 50 ? 'text-yellow-400' : 'text-muted-foreground'
                return (
                  <div key={locale.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{flag}</span>
                      <div>
                        <span className="text-foreground text-sm font-medium">{locale.name}</span>
                        <span className="text-muted-foreground text-xs ml-2 font-mono">{locale.code}</span>
                      </div>
                      {locale.is_base && (
                        <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground border-border">
                          Base
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-medium tabular-nums ${percentColor}`}>{percent}%</span>
                      {!locale.is_base && (
                        <button
                          onClick={() => handleRemoveLocale(locale.id, locale.is_base)}
                          disabled={removingLocaleId === locale.id}
                          className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                          title="Remove locale"
                        >
                          {removingLocaleId === locale.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add locale */}
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Add language</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <LocaleCombobox
                    value={addLocaleCode}
                    onChange={(code, locale) => {
                      setAddLocaleCode(code)
                      setAddLocaleName(locale.name)
                      setLocaleError(null)
                    }}
                    placeholder="Search language or country…"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAddLocale}
                  disabled={!addLocaleCode || existingLocaleCodes.has(addLocaleCode) || addingLocale}
                  className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              {existingLocaleCodes.has(addLocaleCode) && addLocaleCode && (
                <p className="text-xs text-amber-400">This language is already added.</p>
              )}
              {localeError && (
                <p className="text-sm text-destructive">{localeError}</p>
              )}
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section>
          <h2 className="text-lg font-semibold text-red-500 mb-4">Danger Zone</h2>
          <div className="bg-card border border-destructive/30 rounded-xl p-6 space-y-4">
            <div>
              <p className="text-foreground text-sm font-medium">Delete project</p>
              <p className="text-muted-foreground text-sm mt-1">
                This will permanently delete <span className="text-foreground">{project.name}</span> and all its translations. This cannot be undone.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">
                Type <span className="text-foreground font-mono">{project.name}</span> to confirm
              </Label>
              <div className="flex gap-2">
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={project.name}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-red-600 max-w-xs"
                />
                <Button
                  onClick={handleDelete}
                  disabled={deleteConfirm !== project.name || deleting}
                  variant="destructive"
                  className="bg-red-700 hover:bg-red-600 disabled:opacity-30"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {deleting ? 'Deleting…' : 'Delete project'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
