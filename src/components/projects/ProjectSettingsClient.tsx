'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
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
    await fetch(`/api/projects/${project.id}/locales/${localeId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handleDelete() {
    if (deleteConfirm !== project.name) return
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    router.push('/projects')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/projects" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
            Projects
          </Link>
          <span className="text-zinc-700">/</span>
          <Link href={`/${project.id}/editor`} className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
            {project.name}
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-300 text-sm">Settings</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* General */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">General</h2>
          <form onSubmit={handleSave} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Project name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-zinc-100 focus-visible:ring-blue-600"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-blue-600"
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
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">Languages</h2>
          <p className="text-zinc-500 text-sm mb-4">Add or remove languages for this project.</p>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
            {/* Current locales */}
            <div className="space-y-1">
              {project.locales.map((locale) => {
                const flag = flagMap[locale.code] ?? '🌐'
                const percent = locale.percent
                const percentColor =
                  percent >= 80 ? 'text-green-400' : percent >= 50 ? 'text-yellow-400' : 'text-zinc-500'
                return (
                  <div key={locale.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{flag}</span>
                      <div>
                        <span className="text-zinc-200 text-sm font-medium">{locale.name}</span>
                        <span className="text-zinc-600 text-xs ml-2 font-mono">{locale.code}</span>
                      </div>
                      {locale.is_base && (
                        <Badge variant="secondary" className="text-xs bg-zinc-800 text-zinc-400 border-zinc-700">
                          Base
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-medium tabular-nums ${percentColor}`}>{percent}%</span>
                      {!locale.is_base && (
                        <button
                          onClick={() => handleRemoveLocale(locale.id, locale.is_base)}
                          className="text-zinc-600 hover:text-red-400 transition-colors"
                          title="Remove locale"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add locale */}
            <div className="space-y-2 pt-1">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Add language</p>
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
                <p className="text-sm text-red-400">{localeError}</p>
              )}
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section>
          <h2 className="text-lg font-semibold text-red-500 mb-4">Danger Zone</h2>
          <div className="bg-zinc-900 border border-red-900/50 rounded-xl p-6 space-y-4">
            <div>
              <p className="text-zinc-300 text-sm font-medium">Delete project</p>
              <p className="text-zinc-500 text-sm mt-1">
                This will permanently delete <span className="text-zinc-300">{project.name}</span> and all its translations. This cannot be undone.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400 text-sm">
                Type <span className="text-zinc-200 font-mono">{project.name}</span> to confirm
              </Label>
              <div className="flex gap-2">
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={project.name}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-red-600 max-w-xs"
                />
                <Button
                  onClick={handleDelete}
                  disabled={deleteConfirm !== project.name}
                  variant="destructive"
                  className="bg-red-700 hover:bg-red-600 disabled:opacity-30"
                >
                  Delete project
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
