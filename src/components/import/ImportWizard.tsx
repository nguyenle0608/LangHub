'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Check, ChevronRight, FileText, Info, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { Input } from '@/components/ui/input'
import {
  deriveNamespaceFromFilename,
  prefixKeysWithNamespace,
  sanitizeNamespaceSegment,
  type JsonImportStructure,
} from '@/lib/localization-namespaces'
import { allKeysOf, applyGroupSelection, computeSkipKeys, countSelected } from '@/lib/importers/selection'
import { autoMapColumns, suggestedLocaleCode } from '@/lib/importers/delimited-columns'
import { SelectableKeyList } from './SelectableKeyList'
import type { LocaleWithStats, ProjectWithStats } from '@/types'

type Format = 'json' | 'arb' | 'csv' | 'tsv' | 'yaml' | 'android' | 'ios'

interface FileEntry {
  key: string
  file: File
  format: Format | null
  localeId: string
  /**
   * For CSV/TSV only: which locale column of the sheet this job imports. One
   * multi-language sheet becomes one entry per column, so everything after
   * this point — preview, selection, import — works a column at a time and
   * needs no notion of a file holding several languages.
   */
  column?: string
  columnKeyCount?: number
  keyCount?: number
  newCount?: number
  fillCount?: number
  namespace?: string
  // parsed key→value from file, available after computeKeyCounts
  parsedKeys?: Record<string, string>
  // key groups available after computeKeyCounts
  newKeys?: string[]
  fillKeys?: string[]
  duplicateKeys?: string[]
}

interface FileResult {
  filename: string
  created: number
  updated: number
  skipped: number
  total: number
  error?: string
}

interface Props {
  project: ProjectWithStats
  branchId?: string
}

const FORMAT_LABELS: Record<Format, string> = { json: 'JSON', arb: 'ARB', csv: 'CSV', tsv: 'TSV', yaml: 'YAML', android: 'Android XML', ios: 'iOS .strings' }
const STEP_LABELS = ['Upload', 'Configure', 'Preview', 'Import', 'Done']

function detectFormat(filename: string): Format | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'json') return 'json'
  if (ext === 'arb') return 'arb'
  if (ext === 'csv') return 'csv'
  if (ext === 'tsv') return 'tsv'
  if (ext === 'yaml' || ext === 'yml') return 'yaml'
  if (ext === 'xml') return 'android'
  if (ext === 'strings') return 'ios'
  return null
}

function autoDetectLocale(filename: string, locales: ProjectWithStats['locales']): string {
  const name = filename.toLowerCase().replace(/\.[^.]+$/, '')
  const sorted = [...locales].sort((a, b) => b.code.length - a.code.length)
  for (const l of sorted) {
    const code = l.code.toLowerCase().replace('-', '[-_]')
    if (new RegExp(`(^|[^a-z0-9])${code}([^a-z0-9]|$)`).test(name) || name === l.code.toLowerCase()) {
      return l.id
    }
  }
  return locales[0]?.id ?? ''
}

let _counter = 0
function uid() { return `fe-${++_counter}` }

/**
 * What to call one import job. A multi-language sheet produces several jobs
 * from one file, so the filename alone would name them all the same.
 */
function entryLabel(entry: { file: File; column?: string }): string {
  return entry.column ? `${entry.file.name} › ${entry.column}` : entry.file.name
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 justify-center mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={[
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-colors',
              i < step ? 'bg-blue-600 border-blue-600 text-white' :
              i === step ? 'bg-muted border-blue-500 text-blue-600 dark:text-blue-400' :
              'bg-card border-border text-muted-foreground',
            ].join(' ')}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={['text-[10px] whitespace-nowrap', i === step ? 'text-foreground' : 'text-muted-foreground'].join(' ')}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={['w-10 h-px mx-1 mb-4', i < step ? 'bg-blue-600' : 'bg-muted'].join(' ')} />
          )}
        </div>
      ))}
    </div>
  )
}

export function ImportWizard({ project, branchId }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  // Starts from the server-rendered project and grows when a language is
  // created from an unmatched column, without waiting for a page refresh.
  const [locales, setLocales] = useState(project.locales)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [namespace, setNamespace] = useState('')
  const [jsonImportStructure, setJsonImportStructure] = useState<JsonImportStructure>('monolithic')
  const [conflictStrategy, setConflictStrategy] = useState<'overwrite' | 'skip'>('overwrite')
  const [snapshotName, setSnapshotName] = useState('')
  const [createNamedSnapshot, setCreateNamedSnapshot] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [results, setResults] = useState<FileResult[]>([])
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, filename: '' })

  // Per-file import selection: fileKey → Set of dot-keys to import. Spans all
  // three preview groups (new / fill-empty / duplicate), so nothing in the file
  // is imported unless it is in this set.
  const [selectionMap, setSelectionMap] = useState<Record<string, Set<string>>>({})
  // Which files have their duplicates section expanded
  const [expandedPreviewGroups, setExpandedPreviewGroups] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * One upload becomes one import job — except a CSV/TSV, which becomes one
   * job per locale column it actually contains. Expanding here means the rest
   * of the wizard never has to know that a file can hold several languages.
   */
  async function entriesForFile(f: File): Promise<FileEntry[]> {
    const format = detectFormat(f.name)
    const base: FileEntry = {
      key: uid(),
      file: f,
      format,
      localeId: autoDetectLocale(f.name, locales),
      namespace: deriveNamespaceFromFilename(f.name),
    }
    if (format !== 'csv' && format !== 'tsv') return [base]

    const { parseCSV, parseTSV } = await import('@/lib/parsers/csv')
    const columns = (format === 'tsv' ? parseTSV : parseCSV)(await f.text())
    // A sheet that would not parse keeps its single row, so the reason shows
    // up in the preview instead of being swallowed here.
    if (columns[0]?.errors.length) return [base]

    const filled = columns.filter((c) => c.locale && Object.keys(c.keys).length > 0)
    if (filled.length === 0) return [base]

    const skipped = columns.length - filled.length
    if (skipped > 0) {
      toast.info(`${f.name}: ignored ${skipped} empty column${skipped === 1 ? '' : 's'}`)
    }

    const mapping = autoMapColumns(filled.map((c) => c.locale ?? ''), locales)
    return filled.map((column) => ({
      key: uid(),
      file: f,
      format,
      localeId: mapping[column.locale ?? ''] ?? '',
      column: column.locale ?? '',
      columnKeyCount: Object.keys(column.keys).length,
      namespace: deriveNamespaceFromFilename(f.name),
    }))
  }

  async function addFiles(incoming: File[]) {
    const groups = await Promise.all(incoming.map(entriesForFile))
    setFiles((prev) => {
      const next = [...prev]
      for (const group of groups) {
        const name = group[0]?.file.name
        if (!name || next.some((e) => e.file.name === name)) continue
        next.push(...group)
      }
      return next
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void addFiles(Array.from(e.dataTransfer.files))
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((e) => e.key !== key))
  }

  function updateEntry(key: string, patch: Partial<FileEntry>) {
    setFiles((prev) => prev.map((e) => e.key === key ? { ...e, ...patch } : e))
  }

  function updateAllLocales(localeId: string) {
    if (!localeId) return
    setFiles((prev) => prev.map((entry) => ({ ...entry, localeId })))
  }

  /**
   * A sheet column the project has no language for. Creating it here keeps the
   * upload alive — the alternative is leaving the wizard for project settings
   * and starting over — and immediately assigns it to the column that asked
   * for it.
   */
  const createLocaleFromColumn = async (entryKey: string, code: string) => {
    try {
      const options = await fetch('/api/locales-list')
        .then((r) => r.json() as Promise<{ code: string; name: string }[]>)
        .catch(() => [] as { code: string; name: string }[])
      const name = options.find((o) => o.code.toLowerCase() === code.toLowerCase())?.name ?? code

      const resp = await fetch(`/api/projects/${project.id}/locales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name }),
      })
      const data = await resp.json() as { locale?: LocaleWithStats; error?: unknown }
      if (!resp.ok || !data.locale) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not add the language')
      }
      const added = { ...data.locale, total: 0, approved: 0, percent: 0 }
      setLocales((prev) => [...prev, added])
      updateEntry(entryKey, { localeId: added.id })
      toast.success(`Added ${added.code} — ${added.name}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the language')
    }
  }

  const computeKeyCounts = useCallback(async (
    existingKeySet: Set<string>,
    filledKeysByLocale: Map<string, Set<string>>
  ): Promise<{ entries: FileEntry[]; selMap: Record<string, Set<string>> }> => {
    const selMap: Record<string, Set<string>> = {}

    const entries = await Promise.all(files.map(async (entry) => {
      const { file, format } = entry
      if (!format) return entry

      const content = await file.text()
      let keys: Record<string, string> = {}
      if (format === 'json') {
        const { parseJSON } = await import('@/lib/parsers/json')
        keys = parseJSON(content).keys
      } else if (format === 'arb') {
        const { parseARB } = await import('@/lib/parsers/arb')
        keys = parseARB(content).keys
      } else if (format === 'yaml') {
        const { parseYAML } = await import('@/lib/parsers/yaml')
        keys = parseYAML(content).keys
      } else if (format === 'csv' || format === 'tsv') {
        const { parseCSV, parseTSV } = await import('@/lib/parsers/csv')
        const columns = format === 'tsv' ? parseTSV(content) : parseCSV(content)
        const locale = locales.find((l) => l.id === entry.localeId)
        const matching = entry.column
          ? columns.find((r) => r.locale === entry.column)
          : columns.find((r) => r.locale === locale?.code) ?? columns[0]
        keys = matching?.keys ?? {}
      } else if (format === 'android') {
        const { parseAndroidXML } = await import('@/lib/parsers/android')
        keys = parseAndroidXML(content).keys
      } else if (format === 'ios') {
        const { parseIOSStrings } = await import('@/lib/parsers/ios')
        keys = parseIOSStrings(content).keys
      }

      if (format === 'json' && jsonImportStructure === 'namespaced') {
        keys = prefixKeysWithNamespace(keys, entry.namespace ?? deriveNamespaceFromFilename(file.name))
      } else if (namespace.trim()) {
        keys = prefixKeysWithNamespace(keys, namespace.trim())
      }

      const allKeys = Object.keys(keys)
      const filledKeys = filledKeysByLocale.get(entry.localeId) ?? new Set<string>()
      const duplicateKeys = allKeys.filter((k) => filledKeys.has(k))
      const newKeys = allKeys.filter((k) => !existingKeySet.has(k))
      const fillKeys = allKeys.filter((k) => existingKeySet.has(k) && !filledKeys.has(k))
      const newCount = newKeys.length
      const fillCount = fillKeys.length

      // New and fill-empty keys start selected; duplicates follow the global
      // conflict strategy. Every group is de-selectable from the preview.
      selMap[entry.key] = new Set([
        ...newKeys,
        ...fillKeys,
        ...(conflictStrategy === 'overwrite' ? duplicateKeys : []),
      ])

      return { ...entry, keyCount: allKeys.length, newCount, fillCount, parsedKeys: keys, newKeys, fillKeys, duplicateKeys }
    }))

    return { entries, selMap }
  }, [files, namespace, jsonImportStructure, locales, conflictStrategy])

  async function handleGoToPreview() {
    try {
      await loadPreview()
    } catch {
      toast.error('Could not read the selected files — check the format and try again')
    }
  }

  async function loadPreview() {
    const params = new URLSearchParams({ projectId: project.id })
    if (branchId) params.set('branch', branchId)
    const resp = await fetch(`/api/keys?${params}`)
    if (!resp.ok) throw new Error('Failed to load existing keys')
    const json = await resp.json() as {
      data?: Array<{
        key: string
        translations?: Array<{ locale_id: string | null; value: string | null }>
      }>
    }
    const existingKeySet = new Set((json.data ?? []).map((k) => k.key))
    const filledKeysByLocale = new Map<string, Set<string>>()
    for (const key of json.data ?? []) {
      for (const translation of key.translations ?? []) {
        if (!translation.locale_id || !translation.value?.trim()) continue
        if (!filledKeysByLocale.has(translation.locale_id)) filledKeysByLocale.set(translation.locale_id, new Set())
        filledKeysByLocale.get(translation.locale_id)!.add(key.key)
      }
    }

    const { entries, selMap } = await computeKeyCounts(existingKeySet, filledKeysByLocale)
    setFiles(entries)
    setSelectionMap(selMap)
    // Expand every non-empty group, duplicates included, so nothing that will
    // be written is hidden behind a collapsed section.
    setExpandedPreviewGroups(new Set(entries.flatMap((e) => [
      ...(e.newKeys?.length ? [`${e.key}:new`] : []),
      ...(e.fillKeys?.length ? [`${e.key}:fill`] : []),
      ...(e.duplicateKeys?.length ? [`${e.key}:dupe`] : []),
    ])))
    setStep(2)
  }

  const selectedCountFor = (entry: FileEntry) =>
    countSelected(allKeysOf(entry), selectionMap[entry.key])

  function toggleKey(fileKey: string, dotKey: string) {
    setSelectionMap((prev) => {
      const set = new Set(prev[fileKey] ?? [])
      if (set.has(dotKey)) set.delete(dotKey); else set.add(dotKey)
      return { ...prev, [fileKey]: set }
    })
  }

  function setGroupSelection(fileKey: string, groupKeys: string[], checked: boolean) {
    setSelectionMap((prev) => ({
      ...prev,
      [fileKey]: applyGroupSelection(prev[fileKey], groupKeys, checked),
    }))
  }

  function togglePreviewGroup(groupKey: string) {
    setExpandedPreviewGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey)
      return next
    })
  }

  const handleImport = async () => {
    setResults([])
    setStep(3)
    const allResults: FileResult[] = []
    // Only send API requests for files that will actually write something
    const filesToProcess = files.filter((e) => selectedCountFor(e) > 0)
    setImportProgress({ current: 0, total: filesToProcess.length, filename: '' })

    for (let i = 0; i < filesToProcess.length; i++) {
      const entry = filesToProcess[i]!
      const { file, format, localeId } = entry
      if (!format || !localeId) {
        allResults.push({ filename: entryLabel(entry), created: 0, updated: 0, skipped: 0, total: 0, error: 'Missing format or locale' })
        continue
      }
      setImportProgress({ current: i + 1, total: filesToProcess.length, filename: entryLabel(entry) })

      // Skip anything the user de-selected in the preview, across all three
      // groups — new keys included, so they are never force-imported.
      const skipKeys = computeSkipKeys(entry, selectionMap[entry.key])

      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('projectId', project.id)
        fd.append('localeId', localeId)
        fd.append('format', format)
        if (entry.column) fd.append('column', entry.column)
        if (branchId) fd.append('branchId', branchId)
        if (format === 'json') fd.append('importStructure', jsonImportStructure)
        if (format === 'json' && jsonImportStructure === 'namespaced') {
          fd.append('namespace', sanitizeNamespaceSegment(entry.namespace ?? deriveNamespaceFromFilename(file.name)))
        } else if (namespace.trim()) {
          fd.append('namespace', namespace.trim())
        }
        if (skipKeys.length > 0) fd.append('skipKeys', JSON.stringify(skipKeys))
        if (i > 0) fd.append('skipAutoSnapshot', 'true')
        if (i === 0 && createNamedSnapshot && snapshotName) fd.append('snapshotName', snapshotName)

        const resp = await fetch('/api/import', { method: 'POST', body: fd })
        const data = await resp.json() as {
          data?: { created: number; updated: number; skipped: number; total: number }
          error?: string
        }

        if (!resp.ok) {
          allResults.push({ filename: entryLabel(entry), created: 0, updated: 0, skipped: 0, total: 0, error: data.error ?? 'Import failed' })
          toast.error(`${entryLabel(entry)}: ${data.error ?? 'Import failed'}`)
        } else {
          const d = data.data
          allResults.push({
            filename: entryLabel(entry),
            created: d?.created ?? 0,
            updated: d?.updated ?? 0,
            skipped: d?.skipped ?? 0,
            total: d?.total ?? 0,
          })
        }
      } catch {
        allResults.push({ filename: entryLabel(entry), created: 0, updated: 0, skipped: 0, total: 0, error: 'Network error' })
        toast.error(`${entryLabel(entry)}: Network error`)
      }
    }

    setResults(allResults)
    setStep(4)
    // The editor is a Server Component, so its rendered output sits in the
    // client router cache from before the import. Without invalidating it,
    // "View in Editor" replays the pre-import payload — a project that started
    // empty still shows "No keys yet".
    if (allResults.some((result) => !result.error)) router.refresh()
  }

  // Locales that appear more than once across the file list. Multiple files for
  // one locale are allowed only for namespaced JSON imports.
  const localeCounts = files.reduce<Record<string, number>>((acc, e) => {
    if (e.localeId) acc[e.localeId] = (acc[e.localeId] ?? 0) + 1
    return acc
  }, {})
  const duplicatedLocales = new Set(
    Object.entries(localeCounts)
      .filter(([id, c]) => c > 1 && !files
        .filter((e) => e.localeId === id)
        .every((e) => e.format === 'json' && jsonImportStructure === 'namespaced'))
      .map(([id]) => id)
  )
  const uploadDuplicatedLocales = new Set(
    Object.entries(localeCounts)
      .filter(([id, c]) => c > 1 && !files
        .filter((e) => e.localeId === id)
        .every((e) => e.format === 'json'))
      .map(([id]) => id)
  )

  const canContinue = files.length > 0
    && files.every((e) => e.format && e.localeId)
    && (jsonImportStructure !== 'namespaced' || files.every((e) => e.format !== 'json' || sanitizeNamespaceSegment(e.namespace ?? '') !== ''))
    && duplicatedLocales.size === 0
  const canContinueUpload = files.length > 0
    && files.every((e) => e.format && e.localeId)
    && uploadDuplicatedLocales.size === 0

  const totalDuplicates = files.reduce((sum, e) => sum + (e.duplicateKeys?.length ?? 0), 0)
  const totalOverwrites = files.reduce((sum, e) => sum + countSelected(e.duplicateKeys, selectionMap[e.key]), 0)
  // Files that will actually write something (at least one key still selected)
  const activeFiles = files.filter((e) => selectedCountFor(e) > 0)
  const totalSelectedKeys = files.reduce((sum, e) => sum + selectedCountFor(e), 0)
  const totalPreviewKeys = files.reduce((sum, e) => sum + allKeysOf(e).length, 0)

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Nav */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <Link href={`/dashboard/${project.id}/editor`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-medium text-foreground">{project.name} / Import</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <StepIndicator step={step} />

          {/* Step 0: Upload */}
          {step === 0 && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={[
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                  dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-border hover:border-zinc-500',
                ].join(' ')}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-foreground mb-1">Drop files here or click to browse</p>
                <p className="text-xs text-muted-foreground">JSON · ARB · CSV · TSV · YAML · Android XML · iOS .strings — multiple files supported</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".json,.arb,.csv,.tsv,.yaml,.yml,.xml,.strings"
                  className="hidden"
                  onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
                />
              </div>

              {files.length > 0 && (
                <>
                  {!files.some((e) => e.column) && (
                  <div className="flex items-center justify-between gap-3 bg-card/60 border border-border rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-foreground">Target language for all files</p>
                      <p className="text-[10px] text-muted-foreground">Use this when importing many namespace files for one locale.</p>
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        updateAllLocales(e.target.value)
                        e.currentTarget.value = ''
                      }}
                      className="h-7 text-xs bg-muted border border-border rounded px-2 text-foreground min-w-[150px]"
                    >
                      <option value="" disabled>Set all…</option>
                      {locales.map((l) => (
                        <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                      ))}
                    </select>
                  </div>
                  )}

                  {files.some((e) => e.column) && (
                    <p className="text-[11px] text-muted-foreground px-1">
                      This sheet holds several languages. Each column below is imported on its own —
                      change a language, add a missing one, or remove a column you do not want.
                    </p>
                  )}

                  <div className="space-y-2">
                    {files.map((entry) => {
                      const localeConflict = uploadDuplicatedLocales.has(entry.localeId)
                      // A column headed with a real locale code the project
                      // lacks is worth offering to create; "Notes" is not.
                      const suggestion = entry.column ? suggestedLocaleCode(entry.column) : null
                      return (
                        <div
                          key={entry.key}
                          className={[
                            'flex items-center gap-2.5 border rounded-lg px-3 py-2 transition-colors',
                            localeConflict
                              ? 'bg-red-100/70 dark:bg-red-950/30 border-red-300/80 dark:border-red-800/60'
                              : 'bg-card border-border',
                          ].join(' ')}
                        >
                          <FileText className={['h-4 w-4 flex-shrink-0', localeConflict ? 'text-destructive' : 'text-blue-600 dark:text-blue-400'].join(' ')} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground font-mono truncate">
                              {entry.column
                                ? <>{entry.file.name} <span className="text-muted-foreground">›</span> <span className="font-semibold">{entry.column}</span></>
                                : entry.file.name}
                            </p>
                            {localeConflict
                              ? <p className="text-[10px] text-destructive">Locale already used by another column</p>
                              : entry.column
                                ? <p className="text-[10px] text-muted-foreground">{entry.columnKeyCount} key{entry.columnKeyCount === 1 ? '' : 's'} in this column</p>
                                : <p className="text-[10px] text-muted-foreground">{(entry.file.size / 1024).toFixed(1)} KB</p>
                            }
                          </div>
                          {entry.column ? (
                            <span className="h-6 flex items-center text-[10px] text-muted-foreground border border-border rounded px-1.5">
                              {FORMAT_LABELS[entry.format ?? 'csv']}
                            </span>
                          ) : (
                            <select
                              value={entry.format ?? ''}
                              onChange={(e) => updateEntry(entry.key, { format: (e.target.value as Format) || null })}
                              className="h-6 text-xs bg-muted border border-border rounded px-1.5 text-foreground"
                            >
                              <option value="">Format…</option>
                              {(['json', 'arb', 'csv', 'tsv', 'yaml', 'android', 'ios'] as const).map((f) => (
                                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                              ))}
                            </select>
                          )}
                          <select
                            value={entry.localeId}
                            onChange={(e) => updateEntry(entry.key, { localeId: e.target.value })}
                            className={[
                              'h-6 text-xs bg-muted border rounded px-1.5 max-w-[110px]',
                              localeConflict ? 'border-red-700 text-red-700 dark:text-red-300' : 'border-border text-foreground',
                              entry.localeId ? '' : 'text-muted-foreground',
                            ].join(' ')}
                          >
                            {/* Only offered while nothing is chosen: a column
                                has to name a language before it can import. */}
                            {!entry.localeId && <option value="">Choose…</option>}
                            {locales.map((l) => (
                              <option key={l.id} value={l.id}>{l.code}</option>
                            ))}
                          </select>
                          {!entry.localeId && suggestion && (
                            <LoadingButton
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] whitespace-nowrap"
                              onClick={() => createLocaleFromColumn(entry.key, suggestion)}
                            >
                              Add {suggestion}
                            </LoadingButton>
                          )}
                          <button
                            onClick={() => removeFile(entry.key)}
                            className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {uploadDuplicatedLocales.size > 0 && (
                    <p className="text-xs text-destructive text-center">
                      Each language can only be assigned to one file or column unless JSON namespaced import is selected.
                    </p>
                  )}

                  <div className="flex justify-end">
                    <Button size="sm" disabled={!canContinueUpload} onClick={() => setStep(1)}>
                      Continue <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 1: Configure */}
          {step === 1 && (
            <div className="space-y-6">
              {files.some((e) => e.format === 'json') && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">JSON import structure</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'monolithic', label: 'Monolithic', desc: 'Import keys exactly as they appear in each JSON file' },
                      { value: 'namespaced', label: 'Namespaced', desc: 'Prefix JSON keys with each file name, e.g. authen.keyA' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setJsonImportStructure(opt.value)}
                        className={[
                          'text-left px-3 py-2.5 rounded-lg border text-xs transition-colors',
                          jsonImportStructure === opt.value
                            ? 'bg-blue-600/15 border-blue-500 text-blue-700 dark:text-blue-200'
                            : 'border-border text-muted-foreground hover:border-border',
                        ].join(' ')}
                      >
                        <div className="font-medium mb-0.5">{opt.label}</div>
                        <div className="text-[10px] opacity-70">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {jsonImportStructure === 'namespaced' && files.some((e) => e.format === 'json') && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">JSON file namespaces</label>
                  <div className="space-y-2">
                    {files.filter((e) => e.format === 'json').map((entry) => (
                      <div key={entry.key} className="grid grid-cols-[1fr,160px] gap-2 items-center">
                        <span className="text-xs font-mono text-muted-foreground truncate">{entryLabel(entry)}</span>
                        <Input
                          value={entry.namespace ?? ''}
                          onChange={(e) => updateEntry(entry.key, { namespace: sanitizeNamespaceSegment(e.target.value) })}
                          placeholder="namespace"
                          className="h-7 text-xs bg-card border-border font-mono"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Re-importing a single file like authen.json in namespaced mode updates authen.* keys.
                  </p>
                </div>
              )}

              {duplicatedLocales.size > 0 && (
                <p className="text-xs text-destructive bg-red-100/60 dark:bg-red-950/20 border border-red-300 dark:border-red-900/50 rounded-lg px-3 py-2">
                  Multiple files target the same locale. Select JSON namespaced import to continue with feature-split files.
                </p>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Key namespace prefix <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  placeholder="e.g. onboarding → keys become onboarding.key_name"
                  disabled={jsonImportStructure === 'namespaced'}
                  className="text-sm bg-card border-border font-mono"
                />
                {jsonImportStructure === 'namespaced' && (
                  <p className="text-[10px] text-muted-foreground">Disabled because JSON namespaced import uses per-file namespaces.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Default for duplicate keys</label>
                <div className="flex gap-2">
                  {([
                    { value: 'overwrite', label: 'Overwrite', desc: 'Pre-select all duplicates for overwrite' },
                    { value: 'skip', label: 'Skip', desc: 'Pre-select none — review in preview' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConflictStrategy(opt.value)}
                      className={[
                        'flex-1 text-left px-3 py-2.5 rounded-lg border text-xs transition-colors',
                        conflictStrategy === opt.value
                          ? 'bg-blue-600/15 border-blue-500 text-blue-700 dark:text-blue-200'
                          : 'border-border text-muted-foreground hover:border-border',
                      ].join(' ')}
                    >
                      <div className="font-medium mb-0.5">{opt.label}</div>
                      <div className="text-[10px] opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">You can review and override individual keys in the next step.</p>
              </div>

              <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-xs text-blue-700 dark:text-blue-300">⚡ Auto-snapshot created before import</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createNamedSnapshot}
                      onChange={(e) => setCreateNamedSnapshot(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-xs text-muted-foreground">Also create named version:</span>
                  </label>
                  {createNamedSnapshot && (
                    <Input
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      placeholder="e.g. v1.0 — Before onboarding import"
                      className="text-xs bg-card border-border h-7"
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" size="sm" className="border-border" onClick={() => setStep(0)}>Back</Button>
                <LoadingButton size="sm" onClick={handleGoToPreview} disabled={!canContinue}>
                  Preview <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </LoadingButton>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="space-y-5">
              {/* File summary rows */}
              <div className="space-y-3">
                {files.map((entry) => {
                  const locale = locales.find((l) => l.id === entry.localeId)
                  const newKeys = entry.newKeys ?? []
                  const fillKeys = entry.fillKeys ?? []
                  const dupes = entry.duplicateKeys ?? []
                  const selected = selectionMap[entry.key] ?? new Set<string>()
                                  const selectedNew = countSelected(newKeys, selected)
                  const selectedFill = countSelected(fillKeys, selected)
                  const selectedDupes = countSelected(dupes, selected)
                  const isEmpty = selectedCountFor(entry) === 0

                  return (
                    <div key={entry.key} className={['border rounded-xl overflow-hidden', isEmpty ? 'border-border opacity-60' : 'border-border'].join(' ')}>
                      {/* File header row */}
                      <div className={['flex items-center gap-3 px-3 py-2.5', isEmpty ? 'bg-card/20' : 'bg-card/40'].join(' ')}>
                        {isEmpty
                          ? <X className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          : <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />}
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs font-mono text-foreground flex-1 truncate">{entryLabel(entry)}</span>
                        <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          {locale?.code ?? '?'}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {isEmpty ? (
                            <span className="text-muted-foreground italic">nothing to import</span>
                          ) : (
                            <>
                              {selectedNew > 0 && (
                                <span className="text-emerald-700 dark:text-emerald-400">{selectedNew} new</span>
                              )}
                              {selectedFill > 0 && (
                                <>
                                  {selectedNew > 0 && (
                                    <span className="text-border"> · </span>
                                  )}
                                  <span className="text-blue-600 dark:text-blue-400">{selectedFill} fill empty</span>
                                </>
                              )}
                              {(selectedNew > 0 || selectedFill > 0) && selectedDupes > 0 && (
                                <span className="text-border"> · </span>
                              )}
                              {selectedDupes > 0 && (
                                <span className="text-amber-700 dark:text-amber-400">{selectedDupes} overwrite{selectedDupes !== 1 ? 's' : ''}</span>
                              )}
                            </>
                          )}
                        </span>
                      </div>

                      <SelectableKeyList
                        title="New keys"
                        keys={newKeys}
                        tone="new"
                        parsedKeys={entry.parsedKeys}
                        expanded={expandedPreviewGroups.has(`${entry.key}:new`)}
                        onToggle={() => togglePreviewGroup(`${entry.key}:new`)}
                        selected={selected}
                        onToggleKey={(dotKey) => toggleKey(entry.key, dotKey)}
                        onSetAll={(groupKeys, checked) => setGroupSelection(entry.key, groupKeys, checked)}
                      />

                      <SelectableKeyList
                        title="Fill empty translations"
                        keys={fillKeys}
                        tone="fill"
                        parsedKeys={entry.parsedKeys}
                        expanded={expandedPreviewGroups.has(`${entry.key}:fill`)}
                        onToggle={() => togglePreviewGroup(`${entry.key}:fill`)}
                        selected={selected}
                        onToggleKey={(dotKey) => toggleKey(entry.key, dotKey)}
                        onSetAll={(groupKeys, checked) => setGroupSelection(entry.key, groupKeys, checked)}
                      />

                      <SelectableKeyList
                        title="Overwrite existing values"
                        keys={dupes}
                        tone="dupe"
                        parsedKeys={entry.parsedKeys}
                        expanded={expandedPreviewGroups.has(`${entry.key}:dupe`)}
                        onToggle={() => togglePreviewGroup(`${entry.key}:dupe`)}
                        selected={selected}
                        onToggleKey={(dotKey) => toggleKey(entry.key, dotKey)}
                        onSetAll={(groupKeys, checked) => setGroupSelection(entry.key, groupKeys, checked)}
                      />

                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              <div className="text-xs text-muted-foreground text-center space-x-2">
                <span>{activeFiles.length} of {files.length} file{files.length !== 1 ? 's' : ''} will import</span>
                <span className="text-border">·</span>
                <span>
                  <span className="text-foreground">{totalSelectedKeys}</span>
                  <span> of {totalPreviewKeys} keys selected</span>
                </span>
                {totalDuplicates > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span>
                      <span className="text-amber-700 dark:text-amber-400">{totalOverwrites}</span>
                      <span> of {totalDuplicates} duplicates overwritten</span>
                    </span>
                  </>
                )}
              </div>

              {activeFiles.length === 0 && (
                <p className="text-xs text-muted-foreground text-center bg-card border border-border rounded-lg py-2 px-3">
                  No changes to import — select at least one key to overwrite, or go back and add new files.
                </p>
              )}

              <div className="flex justify-between">
                <Button variant="outline" size="sm" className="border-border" onClick={() => setStep(1)}>Back</Button>
                <Button size="sm" onClick={handleImport} disabled={activeFiles.length === 0}>
                  Import {activeFiles.length} file{activeFiles.length !== 1 ? 's' : ''} <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 3 && (
            <div className="text-center py-16 space-y-5">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
              <div>
                <p className="text-sm text-foreground">
                  Importing <span className="font-mono text-foreground">{importProgress.filename}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {files.some((e) => e.column) ? 'Column' : 'File'} {importProgress.current} of {importProgress.total}
                </p>
              </div>
              <div className="max-w-xs mx-auto bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
                  <Check className="h-7 w-7 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Import complete!</h3>
              </div>

              <div className="space-y-2">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={[
                      'flex items-center gap-3 border rounded-lg px-3 py-2.5',
                      r.error ? 'border-red-300/80 dark:border-red-800/60 bg-red-50 dark:bg-red-900/10' : 'border-border bg-card/40',
                    ].join(' ')}
                  >
                    {r.error
                      ? <X className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                      : <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />}
                    <span className="text-xs font-mono text-foreground flex-1 truncate">{r.filename}</span>
                    {r.error ? (
                      <span className="text-xs text-destructive">{r.error}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {r.created > 0 && <span className="text-emerald-700 dark:text-emerald-400">{r.created} new</span>}
                        {r.updated > 0 && <span className="text-amber-700 dark:text-amber-400">{r.updated} updated</span>}
                        {r.skipped > 0 && <span className="text-muted-foreground">{r.skipped} skipped</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border"
                  onClick={() => { setStep(0); setFiles([]); setResults([]); setSelectionMap({}); setExpandedPreviewGroups(new Set()) }}
                >
                  Import More
                </Button>
                <Link href={`/dashboard/${project.id}/editor`}>
                  <Button size="sm">View in Editor</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
