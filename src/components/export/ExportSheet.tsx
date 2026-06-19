'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { ProjectWithStats } from '@/types'

type Format = 'json' | 'arb' | 'csv' | 'yaml'
type Filter = 'all' | 'approved' | 'reviewed_approved'

const LOCALE_FLAGS: Record<string, string> = {
  en: '🇺🇸', vi: '🇻🇳', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳',
  fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸', pt: '🇧🇷', th: '🇹🇭', id: '🇮🇩',
}

interface Props {
  open: boolean
  project: ProjectWithStats
  onClose: () => void
}

export function ExportSheet({ open, project, onClose }: Props) {
  const [selectedLocales, setSelectedLocales] = useState<Set<string>>(
    new Set(project.locales.map((l) => l.id))
  )
  const [format, setFormat] = useState<Format>('json')
  const [filter, setFilter] = useState<Filter>('all')
  const [nested, setNested] = useState(true)
  const [exporting, setExporting] = useState(false)

  const toggleLocale = (id: string) => {
    setSelectedLocales((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  const fileCount = format === 'csv' ? 1 : selectedLocales.size
  const previewText = fileCount === 1
    ? `1 file`
    : `${fileCount} files in ZIP`

  const handleExport = async () => {
    setExporting(true)
    try {
      const resp = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          localeIds: Array.from(selectedLocales),
          format,
          filter,
          nested: format === 'json' ? nested : undefined,
        }),
      })

      if (!resp.ok) {
        const data = await resp.json() as { error?: string }
        toast.error(data.error ?? 'Export failed')
        return
      }

      // Trigger download
      const blob = await resp.blob()
      const contentDisposition = resp.headers.get('Content-Disposition') ?? ''
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] ?? `export.${format === 'csv' ? 'csv' : 'zip'}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      toast.success(`Exported ${previewText}`)
      onClose()
    } catch {
      toast.error('Network error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full max-w-md p-0 bg-zinc-950 border-zinc-800 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <SheetTitle className="text-zinc-100 text-base">Export Translations</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Section 1: Locales */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Locales</div>
            <div className="space-y-1">
              {project.locales.map((locale) => (
                <label key={locale.id} className="flex items-center gap-3 py-1.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedLocales.has(locale.id)}
                    onChange={() => toggleLocale(locale.id)}
                    className="rounded border-zinc-600"
                  />
                  <span className="text-base">{LOCALE_FLAGS[locale.code] ?? '🌐'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-200">{locale.name}</span>
                    <span className="ml-2 text-xs text-zinc-500 uppercase">{locale.code}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{locale.percent}%</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 2: Format */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Format</div>
            <div className="grid grid-cols-4 gap-2">
              {(['json', 'arb', 'csv', 'yaml'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={[
                    'py-2 text-xs rounded border transition-colors uppercase',
                    format === f ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
            {format === 'json' && (
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={nested}
                  onChange={(e) => setNested(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                <span className="text-xs text-zinc-400">Nested output (rebuild dot.notation → object)</span>
              </label>
            )}
            {format === 'csv' && (
              <p className="text-[11px] text-zinc-500">All locales combined in one file with columns per locale</p>
            )}
          </div>

          {/* Section 3: Filter */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Include translations</div>
            <div className="space-y-1">
              {([
                ['all', 'All translations (including empty)'],
                ['reviewed_approved', 'Reviewed + Approved only'],
                ['approved', 'Approved only'],
              ] as const).map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input
                    type="radio"
                    name="filter"
                    value={val}
                    checked={filter === val}
                    onChange={() => setFilter(val)}
                    className="border-zinc-600"
                  />
                  <span className="text-sm text-zinc-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 4: Preview */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-1">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wide">Export preview</div>
            <p className="text-sm text-zinc-200 font-medium">{previewText}</p>
            <p className="text-xs text-zinc-500">
              {format === 'csv'
                ? `translations-${Array.from(selectedLocales).map((id) => project.locales.find((l) => l.id === id)?.code).join('-')}.csv`
                : fileCount === 1
                ? `${project.locales.find((l) => selectedLocales.has(l.id))?.code}.${format === 'arb' ? 'arb' : format}`
                : 'translations.zip'}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex-shrink-0">
          <Button
            className="w-full gap-2"
            onClick={handleExport}
            disabled={exporting || selectedLocales.size === 0}
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : `Export ${previewText}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
