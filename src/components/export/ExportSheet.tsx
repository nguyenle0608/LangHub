'use client'

import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ProjectWithStats } from '@/types'
import { localeFlag } from '@/lib/locale-flag'
import type { JsonExportStructure } from '@/lib/localization-namespaces'

type Format = 'json' | 'arb' | 'csv' | 'yaml' | 'android' | 'ios'
type Filter = 'all' | 'approved' | 'reviewed_approved'

const FORMATS: { value: Format; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'arb', label: 'ARB' },
  { value: 'csv', label: 'CSV' },
  { value: 'yaml', label: 'YAML' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
]

const SINGLE_FILE_NAME: Partial<Record<Format, string>> = {
  android: 'strings.xml',
  ios: 'Localizable.strings',
}

interface Props {
  open: boolean
  project: ProjectWithStats
  branchId?: string
  onClose: () => void
}

export function ExportSheet({ open, project, branchId, onClose }: Props) {
  const [selectedLocales, setSelectedLocales] = useState<Set<string>>(
    new Set(project.locales.map((l) => l.id))
  )
  const [format, setFormat] = useState<Format>('json')
  const [filter, setFilter] = useState<Filter>('all')
  const [nested, setNested] = useState(true)
  const [jsonStructure, setJsonStructure] = useState<JsonExportStructure>('monolithic')
  const [includeEmpty, setIncludeEmpty] = useState(false)
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
    ? (format === 'json' && jsonStructure === 'namespaced' ? 'namespace ZIP' : `1 file`)
    : `${fileCount} files in ZIP`
  const selectedLocaleCode = project.locales.find((l) => selectedLocales.has(l.id))?.code
  const previewFilename = format === 'csv'
    ? `translations-${Array.from(selectedLocales).map((id) => project.locales.find((l) => l.id === id)?.code).join('-')}.csv`
    : format === 'json' && jsonStructure === 'namespaced'
    ? (fileCount === 1 ? `${selectedLocaleCode}-namespaces.zip` : 'translations.zip')
    : fileCount === 1
    ? (SINGLE_FILE_NAME[format] ?? `${selectedLocaleCode}.${format}`)
    : 'translations.zip'

  const handleExport = async () => {
    setExporting(true)
    try {
      const resp = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          branchId,
          localeIds: Array.from(selectedLocales),
          format,
          filter,
          nested: format === 'json' ? nested : undefined,
          jsonStructure: format === 'json' ? jsonStructure : undefined,
          includeEmpty,
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md p-0 bg-background border-border flex flex-col max-h-[90vh] [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-foreground text-base">Export Translations</DialogTitle>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Section 1: Locales */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Locales</div>
            <div className="space-y-1">
              {project.locales.map((locale) => (
                <label key={locale.id} className="flex items-center gap-3 py-1.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedLocales.has(locale.id)}
                    onChange={() => toggleLocale(locale.id)}
                    className="rounded border-border"
                  />
                  <span className="text-base">{localeFlag(locale.code)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-foreground">{locale.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground uppercase">{locale.code}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{locale.percent}%</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 2: Format */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Format</div>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={[
                    'py-2 text-xs rounded border transition-colors',
                    format === f.value ? 'bg-blue-600/20 border-blue-500 text-blue-700 dark:text-blue-300' : 'border-border text-muted-foreground hover:border-border',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {(format === 'android' || format === 'ios') && (
              <p className="text-[11px] text-muted-foreground">
                {format === 'android'
                  ? 'Android strings.xml. Multiple locales export as values-<code>/strings.xml in a ZIP.'
                  : 'iOS Localizable.strings. Multiple locales export as <code>.lproj/Localizable.strings in a ZIP.'}
              </p>
            )}
            {format === 'json' && (
              <div className="space-y-2 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'monolithic', label: 'Monolithic', desc: 'One JSON file per locale' },
                    { value: 'namespaced', label: 'Namespaced', desc: 'Split JSON files by first key segment' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setJsonStructure(opt.value)}
                      className={[
                        'text-left px-3 py-2 rounded border text-xs transition-colors',
                        jsonStructure === opt.value
                          ? 'bg-blue-600/20 border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'border-border text-muted-foreground hover:border-border',
                      ].join(' ')}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-[10px] opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                {jsonStructure === 'monolithic' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nested}
                      onChange={(e) => setNested(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-xs text-muted-foreground">Nested output (rebuild dot.notation → object)</span>
                  </label>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Example: authen.login.title exports to authen.json as login.title.
                  </p>
                )}
              </div>
            )}
            {format === 'csv' && (
              <p className="text-[11px] text-muted-foreground">All locales combined in one file with columns per locale</p>
            )}
          </div>

          {/* Section 3: Filter */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Status filter</div>
            <div className="space-y-1">
              {([
                ['all', 'All statuses'],
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
                    className="border-border"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>
            <label className="flex items-start gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={includeEmpty}
                onChange={(e) => setIncludeEmpty(e.target.checked)}
                className="rounded border-border mt-0.5"
              />
              <span className="text-xs text-muted-foreground">
                Export all keys
                <span className="block text-[10px] text-muted-foreground">
                  Export every key. Keys without a value matching the selected status filter become empty strings.
                </span>
              </span>
            </label>
            {!includeEmpty && (
              <p className="text-[10px] text-muted-foreground">
                Without this, only non-empty translations matching the selected status are exported.
              </p>
            )}
          </div>

          {/* Section 4: Preview */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-1">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Export preview</div>
            <p className="text-sm text-foreground font-medium">{previewText}</p>
            <p className="text-xs text-muted-foreground">
              {previewFilename}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex-shrink-0">
          <Button
            className="w-full gap-2"
            onClick={handleExport}
            disabled={exporting || selectedLocales.size === 0}
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : `Export ${previewText}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
