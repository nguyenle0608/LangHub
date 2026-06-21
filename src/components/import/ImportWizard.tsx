'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Check, ChevronRight, FileText, Info, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseJSON } from '@/lib/parsers/json'
import { parseARB } from '@/lib/parsers/arb'
import { parseCSV } from '@/lib/parsers/csv'
import { parseYAML } from '@/lib/parsers/yaml'
import type { ProjectWithStats } from '@/types'

type Format = 'json' | 'arb' | 'csv' | 'yaml'

interface FileEntry {
  key: string
  file: File
  format: Format | null
  localeId: string
  keyCount?: number
  newCount?: number
  // parsed key→value from file, available after computeKeyCounts
  parsedKeys?: Record<string, string>
  // existing keys that are in this file (duplicates), available after computeKeyCounts
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

const FORMAT_LABELS: Record<Format, string> = { json: 'JSON', arb: 'ARB', csv: 'CSV', yaml: 'YAML' }
const STEP_LABELS = ['Upload', 'Configure', 'Preview', 'Import', 'Done']
const MAX_PREVIEW_ROWS = 300

function detectFormat(filename: string): Format | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'json') return 'json'
  if (ext === 'arb') return 'arb'
  if (ext === 'csv') return 'csv'
  if (ext === 'yaml' || ext === 'yml') return 'yaml'
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

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 justify-center mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={[
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-colors',
              i < step ? 'bg-blue-600 border-blue-600 text-white' :
              i === step ? 'bg-zinc-800 border-blue-500 text-blue-400' :
              'bg-zinc-900 border-zinc-700 text-zinc-600',
            ].join(' ')}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={['text-[10px] whitespace-nowrap', i === step ? 'text-zinc-300' : 'text-zinc-600'].join(' ')}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={['w-10 h-px mx-1 mb-4', i < step ? 'bg-blue-600' : 'bg-zinc-800'].join(' ')} />
          )}
        </div>
      ))}
    </div>
  )
}

export function ImportWizard({ project, branchId }: Props) {
  const [step, setStep] = useState(0)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [namespace, setNamespace] = useState('')
  const [conflictStrategy, setConflictStrategy] = useState<'overwrite' | 'skip'>('overwrite')
  const [snapshotName, setSnapshotName] = useState('')
  const [createNamedSnapshot, setCreateNamedSnapshot] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [results, setResults] = useState<FileResult[]>([])
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, filename: '' })

  // Per-file overwrite selection: fileKey → Set of duplicate dot-keys to overwrite
  const [overwriteMap, setOverwriteMap] = useState<Record<string, Set<string>>>({})
  // Which files have their duplicates section expanded
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: File[]) {
    setFiles((prev) => {
      const next = [...prev]
      for (const f of incoming) {
        if (next.some((e) => e.file.name === f.name)) continue
        next.push({
          key: uid(),
          file: f,
          format: detectFormat(f.name),
          localeId: autoDetectLocale(f.name, project.locales),
        })
      }
      return next
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((e) => e.key !== key))
  }

  function updateEntry(key: string, patch: Partial<FileEntry>) {
    setFiles((prev) => prev.map((e) => e.key === key ? { ...e, ...patch } : e))
  }

  const computeKeyCounts = useCallback(async (existingKeySet: Set<string>): Promise<{ entries: FileEntry[]; owMap: Record<string, Set<string>> }> => {
    const owMap: Record<string, Set<string>> = {}

    const entries = await Promise.all(files.map(async (entry) => {
      const { file, format } = entry
      if (!format) return entry

      const content = await file.text()
      let keys: Record<string, string> = {}
      if (format === 'json') keys = parseJSON(content).keys
      else if (format === 'arb') keys = parseARB(content).keys
      else if (format === 'yaml') keys = parseYAML(content).keys
      else if (format === 'csv') {
        const locale = project.locales.find((l) => l.id === entry.localeId)
        const csvResults = parseCSV(content)
        const matching = csvResults.find((r) => r.locale === locale?.code) ?? csvResults[0]
        keys = matching?.keys ?? {}
      }

      const prefix = namespace.trim()
      if (prefix) {
        const prefixed: Record<string, string> = {}
        for (const [k, v] of Object.entries(keys)) prefixed[`${prefix}.${k}`] = v
        keys = prefixed
      }

      const allKeys = Object.keys(keys)
      const duplicateKeys = allKeys.filter((k) => existingKeySet.has(k))
      const newCount = allKeys.length - duplicateKeys.length

      // Init overwrite set based on global strategy
      owMap[entry.key] = conflictStrategy === 'overwrite'
        ? new Set(duplicateKeys)
        : new Set()

      return { ...entry, keyCount: allKeys.length, newCount, parsedKeys: keys, duplicateKeys }
    }))

    return { entries, owMap }
  }, [files, namespace, project.locales, conflictStrategy])

  async function handleGoToPreview() {
    const params = new URLSearchParams({ projectId: project.id })
    if (branchId) params.set('branch', branchId)
    const resp = await fetch(`/api/keys?${params}`)
    const json = await resp.json() as { data?: { key: string }[] }
    const existingKeySet = new Set((json.data ?? []).map((k) => k.key))

    const { entries, owMap } = await computeKeyCounts(existingKeySet)
    setFiles(entries)
    setOverwriteMap(owMap)
    // Auto-expand files that have duplicates
    const withDupes = new Set(entries.filter((e) => (e.duplicateKeys?.length ?? 0) > 0).map((e) => e.key))
    setExpandedFiles(withDupes)
    setStep(2)
  }

  function toggleOverwrite(fileKey: string, dotKey: string) {
    setOverwriteMap((prev) => {
      const set = new Set(prev[fileKey] ?? [])
      if (set.has(dotKey)) set.delete(dotKey); else set.add(dotKey)
      return { ...prev, [fileKey]: set }
    })
  }

  function setAllOverwrites(fileKey: string, duplicateKeys: string[], checked: boolean) {
    setOverwriteMap((prev) => ({
      ...prev,
      [fileKey]: checked ? new Set(duplicateKeys) : new Set(),
    }))
  }

  const handleImport = async () => {
    setResults([])
    setStep(3)
    const allResults: FileResult[] = []
    // Only send API requests for files that will actually write something
    const filesToProcess = files.filter((e) => (e.newCount ?? 0) + (overwriteMap[e.key]?.size ?? 0) > 0)
    setImportProgress({ current: 0, total: filesToProcess.length, filename: '' })

    for (let i = 0; i < filesToProcess.length; i++) {
      const entry = filesToProcess[i]!
      const { file, format, localeId, duplicateKeys } = entry
      if (!format || !localeId) {
        allResults.push({ filename: file.name, created: 0, updated: 0, skipped: 0, total: 0, error: 'Missing format or locale' })
        continue
      }
      setImportProgress({ current: i + 1, total: filesToProcess.length, filename: file.name })

      // Compute skip list: duplicates the user did NOT select for overwrite
      const selectedOverwrites = overwriteMap[entry.key] ?? new Set<string>()
      const skipKeys = (duplicateKeys ?? []).filter((k) => !selectedOverwrites.has(k))

      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('projectId', project.id)
        fd.append('localeId', localeId)
        fd.append('format', format)
        if (branchId) fd.append('branchId', branchId)
        if (namespace.trim()) fd.append('namespace', namespace.trim())
        if (skipKeys.length > 0) fd.append('skipKeys', JSON.stringify(skipKeys))
        if (i > 0) fd.append('skipAutoSnapshot', 'true')
        if (i === 0 && createNamedSnapshot && snapshotName) fd.append('snapshotName', snapshotName)

        const resp = await fetch('/api/import', { method: 'POST', body: fd })
        const data = await resp.json() as {
          data?: { created: number; updated: number; skipped: number; total: number }
          error?: string
        }

        if (!resp.ok) {
          allResults.push({ filename: file.name, created: 0, updated: 0, skipped: 0, total: 0, error: data.error ?? 'Import failed' })
          toast.error(`${file.name}: ${data.error ?? 'Import failed'}`)
        } else {
          const d = data.data
          allResults.push({
            filename: file.name,
            created: d?.created ?? 0,
            updated: d?.updated ?? 0,
            skipped: d?.skipped ?? 0,
            total: d?.total ?? 0,
          })
        }
      } catch {
        allResults.push({ filename: file.name, created: 0, updated: 0, skipped: 0, total: 0, error: 'Network error' })
        toast.error(`${file.name}: Network error`)
      }
    }

    setResults(allResults)
    setStep(4)
  }

  // Locales that appear more than once across the file list
  const localeCounts = files.reduce<Record<string, number>>((acc, e) => {
    if (e.localeId) acc[e.localeId] = (acc[e.localeId] ?? 0) + 1
    return acc
  }, {})
  const duplicatedLocales = new Set(Object.entries(localeCounts).filter(([, c]) => c > 1).map(([id]) => id))

  const canContinue = files.length > 0
    && files.every((e) => e.format && e.localeId)
    && duplicatedLocales.size === 0

  const totalDuplicates = files.reduce((sum, e) => sum + (e.duplicateKeys?.length ?? 0), 0)
  const totalOverwrites = Object.values(overwriteMap).reduce((sum, s) => sum + s.size, 0)
  // Files that will actually write something (new keys OR selected overwrites > 0)
  const activeFiles = files.filter((e) => (e.newCount ?? 0) + (overwriteMap[e.key]?.size ?? 0) > 0)

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 flex-shrink-0">
        <Link href={`/${project.id}/editor`} className="text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-medium text-zinc-200">{project.name} / Import</span>
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
                  dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-zinc-700 hover:border-zinc-500',
                ].join(' ')}
              >
                <Upload className="h-8 w-8 mx-auto text-zinc-500 mb-3" />
                <p className="text-sm text-zinc-300 mb-1">Drop files here or click to browse</p>
                <p className="text-xs text-zinc-600">JSON · ARB · CSV · YAML — multiple files supported</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".json,.arb,.csv,.yaml,.yml"
                  className="hidden"
                  onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
                />
              </div>

              {files.length > 0 && (
                <>
                  <div className="space-y-2">
                    {files.map((entry) => {
                      const localeConflict = duplicatedLocales.has(entry.localeId)
                      return (
                        <div
                          key={entry.key}
                          className={[
                            'flex items-center gap-2.5 border rounded-lg px-3 py-2 transition-colors',
                            localeConflict
                              ? 'bg-red-950/30 border-red-800/60'
                              : 'bg-zinc-900 border-zinc-800',
                          ].join(' ')}
                        >
                          <FileText className={['h-4 w-4 flex-shrink-0', localeConflict ? 'text-red-400' : 'text-blue-400'].join(' ')} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-200 font-mono truncate">{entry.file.name}</p>
                            {localeConflict
                              ? <p className="text-[10px] text-red-400">Locale already used by another file</p>
                              : <p className="text-[10px] text-zinc-600">{(entry.file.size / 1024).toFixed(1)} KB</p>
                            }
                          </div>
                          <select
                            value={entry.format ?? ''}
                            onChange={(e) => updateEntry(entry.key, { format: (e.target.value as Format) || null })}
                            className="h-6 text-xs bg-zinc-800 border border-zinc-700 rounded px-1.5 text-zinc-300"
                          >
                            <option value="">Format…</option>
                            {(['json', 'arb', 'csv', 'yaml'] as const).map((f) => (
                              <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                            ))}
                          </select>
                          <select
                            value={entry.localeId}
                            onChange={(e) => updateEntry(entry.key, { localeId: e.target.value })}
                            className={[
                              'h-6 text-xs bg-zinc-800 border rounded px-1.5 max-w-[110px]',
                              localeConflict ? 'border-red-700 text-red-300' : 'border-zinc-700 text-zinc-300',
                            ].join(' ')}
                          >
                            {project.locales.map((l) => (
                              <option key={l.id} value={l.id}>{l.code}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeFile(entry.key)}
                            className="text-zinc-600 hover:text-red-400 transition-colors ml-0.5"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {duplicatedLocales.size > 0 && (
                    <p className="text-xs text-red-400 text-center">
                      Each locale can only be assigned to one file per import batch.
                    </p>
                  )}

                  <div className="flex justify-end">
                    <Button size="sm" disabled={!canContinue} onClick={() => setStep(1)}>
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
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">
                  Key namespace prefix <span className="text-zinc-600">(optional)</span>
                </label>
                <Input
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  placeholder="e.g. onboarding → keys become onboarding.key_name"
                  className="text-sm bg-zinc-900 border-zinc-700 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Default for duplicate keys</label>
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
                          ? 'bg-blue-600/15 border-blue-500 text-blue-200'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600',
                      ].join(' ')}
                    >
                      <div className="font-medium mb-0.5">{opt.label}</div>
                      <div className="text-[10px] opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600">You can review and override individual keys in the next step.</p>
              </div>

              <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3">
                <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-xs text-blue-300">⚡ Auto-snapshot created before import</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createNamedSnapshot}
                      onChange={(e) => setCreateNamedSnapshot(e.target.checked)}
                      className="rounded border-zinc-600"
                    />
                    <span className="text-xs text-zinc-400">Also create named version:</span>
                  </label>
                  {createNamedSnapshot && (
                    <Input
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      placeholder="e.g. v1.0 — Before onboarding import"
                      className="text-xs bg-zinc-900 border-zinc-700 h-7"
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" size="sm" className="border-zinc-700" onClick={() => setStep(0)}>Back</Button>
                <Button size="sm" onClick={handleGoToPreview}>
                  Preview <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="space-y-5">
              {/* File summary rows */}
              <div className="space-y-3">
                {files.map((entry) => {
                  const locale = project.locales.find((l) => l.id === entry.localeId)
                  const dupes = entry.duplicateKeys ?? []
                  const selected = overwriteMap[entry.key] ?? new Set<string>()
                  const isExpanded = expandedFiles.has(entry.key)
                  const effectiveCount = (entry.newCount ?? 0) + selected.size
                  const isEmpty = effectiveCount === 0

                  return (
                    <div key={entry.key} className={['border rounded-xl overflow-hidden', isEmpty ? 'border-zinc-700 opacity-60' : 'border-zinc-800'].join(' ')}>
                      {/* File header row */}
                      <div className={['flex items-center gap-3 px-3 py-2.5', isEmpty ? 'bg-zinc-900/20' : 'bg-zinc-900/40'].join(' ')}>
                        {isEmpty
                          ? <X className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                          : <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                        <FileText className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                        <span className="text-xs font-mono text-zinc-300 flex-1 truncate">{entry.file.name}</span>
                        <span className="text-[10px] text-zinc-400 border border-zinc-700 rounded px-1.5 py-0.5">
                          {locale?.code ?? '?'}
                        </span>
                        <span className="text-xs text-zinc-500 tabular-nums">
                          {isEmpty ? (
                            <span className="text-zinc-600 italic">nothing to import</span>
                          ) : (
                            <>
                              {entry.newCount !== undefined && entry.newCount > 0 && (
                                <span className="text-emerald-400">{entry.newCount} new</span>
                              )}
                              {entry.newCount !== undefined && entry.newCount > 0 && dupes.length > 0 && (
                                <span className="text-zinc-700"> · </span>
                              )}
                              {dupes.length > 0 && (
                                <span className="text-amber-400">{dupes.length} duplicate{dupes.length !== 1 ? 's' : ''}</span>
                              )}
                            </>
                          )}
                        </span>
                      </div>

                      {/* Duplicate keys section */}
                      {dupes.length > 0 && (
                        <>
                          <button
                            className="w-full flex items-center justify-between px-3 py-2 bg-amber-500/5 border-t border-zinc-800 text-xs text-amber-400/80 hover:bg-amber-500/10 transition-colors"
                            onClick={() => setExpandedFiles((prev) => {
                              const next = new Set(prev)
                              if (next.has(entry.key)) next.delete(entry.key); else next.add(entry.key)
                              return next
                            })}
                          >
                            <span>
                              {selected.size} of {dupes.length} duplicate{dupes.length !== 1 ? 's' : ''} will be overwritten
                            </span>
                            {isExpanded
                              ? <ChevronUp className="h-3.5 w-3.5" />
                              : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>

                          {isExpanded && (
                            <div className="border-t border-zinc-800">
                              {/* Select all / none */}
                              <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/60">
                                <span className="text-[10px] text-zinc-500 flex-1">Key</span>
                                <span className="text-[10px] text-zinc-500 flex-1">New value</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    className="text-[10px] text-blue-400 hover:text-blue-300"
                                    onClick={() => setAllOverwrites(entry.key, dupes, true)}
                                  >
                                    All
                                  </button>
                                  <span className="text-zinc-700">·</span>
                                  <button
                                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                                    onClick={() => setAllOverwrites(entry.key, dupes, false)}
                                  >
                                    None
                                  </button>
                                </div>
                              </div>

                              <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/50">
                                {dupes.slice(0, MAX_PREVIEW_ROWS).map((dotKey) => {
                                  const newVal = entry.parsedKeys?.[dotKey] ?? ''
                                  const willOverwrite = selected.has(dotKey)
                                  return (
                                    <label
                                      key={dotKey}
                                      className="flex items-start gap-3 px-3 py-2 hover:bg-zinc-900/40 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={willOverwrite}
                                        onChange={() => toggleOverwrite(entry.key, dotKey)}
                                        className="mt-0.5 rounded border-zinc-600 flex-shrink-0"
                                      />
                                      <span className="text-[11px] font-mono text-zinc-300 flex-1 min-w-0 truncate">
                                        {dotKey}
                                      </span>
                                      <span className={[
                                        'text-[11px] flex-1 min-w-0 truncate',
                                        willOverwrite ? 'text-zinc-400' : 'text-zinc-600 line-through',
                                      ].join(' ')}>
                                        {newVal}
                                      </span>
                                    </label>
                                  )
                                })}
                                {dupes.length > MAX_PREVIEW_ROWS && (
                                  <div className="px-3 py-2 text-xs text-zinc-600">
                                    … and {dupes.length - MAX_PREVIEW_ROWS} more
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              <div className="text-xs text-zinc-500 text-center space-x-2">
                <span>{activeFiles.length} of {files.length} file{files.length !== 1 ? 's' : ''} will import</span>
                {totalDuplicates > 0 && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span>
                      <span className="text-amber-400">{totalOverwrites}</span>
                      <span> of {totalDuplicates} duplicates overwritten</span>
                    </span>
                  </>
                )}
              </div>

              {activeFiles.length === 0 && (
                <p className="text-xs text-zinc-500 text-center bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3">
                  No changes to import — select at least one key to overwrite, or go back and add new files.
                </p>
              )}

              <div className="flex justify-between">
                <Button variant="outline" size="sm" className="border-zinc-700" onClick={() => setStep(1)}>Back</Button>
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
                <p className="text-sm text-zinc-300">
                  Importing <span className="font-mono text-zinc-100">{importProgress.filename}</span>
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  File {importProgress.current} of {importProgress.total}
                </p>
              </div>
              <div className="max-w-xs mx-auto bg-zinc-800 rounded-full h-1.5 overflow-hidden">
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
                <h3 className="text-lg font-semibold text-zinc-100">Import complete!</h3>
              </div>

              <div className="space-y-2">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={[
                      'flex items-center gap-3 border rounded-lg px-3 py-2.5',
                      r.error ? 'border-red-800/60 bg-red-900/10' : 'border-zinc-800 bg-zinc-900/40',
                    ].join(' ')}
                  >
                    {r.error
                      ? <X className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                      : <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                    <span className="text-xs font-mono text-zinc-300 flex-1 truncate">{r.filename}</span>
                    {r.error ? (
                      <span className="text-xs text-red-400">{r.error}</span>
                    ) : (
                      <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                        {r.created > 0 && <span className="text-emerald-400">{r.created} new</span>}
                        {r.updated > 0 && <span className="text-amber-400">{r.updated} updated</span>}
                        {r.skipped > 0 && <span className="text-zinc-500">{r.skipped} skipped</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700"
                  onClick={() => { setStep(0); setFiles([]); setResults([]); setOverwriteMap({}) }}
                >
                  Import More
                </Button>
                <Link href={`/${project.id}/editor`}>
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
