'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Check, ChevronRight, FileText, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseJSON } from '@/lib/parsers/json'
import { parseARB } from '@/lib/parsers/arb'
import { parseCSV } from '@/lib/parsers/csv'
import { parseYAML } from '@/lib/parsers/yaml'
import type { ProjectWithStats } from '@/types'

type Format = 'json' | 'arb' | 'csv' | 'yaml'
type ConflictType = 'new' | 'update'

interface PreviewRow {
  key: string
  value: string
  conflict: ConflictType
}

interface Props {
  project: ProjectWithStats
  branchId?: string
}

const FORMAT_LABELS: Record<Format, string> = { json: 'JSON', arb: 'ARB', csv: 'CSV', yaml: 'YAML' }

const STEP_LABELS = ['Upload', 'Configure', 'Preview', 'Import', 'Done']

function detectFormat(filename: string): Format | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'json') return 'json'
  if (ext === 'arb') return 'arb'
  if (ext === 'csv') return 'csv'
  if (ext === 'yaml' || ext === 'yml') return 'yaml'
  return null
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
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<Format | null>(null)
  const [localeId, setLocaleId] = useState(project.locales[0]?.id ?? '')
  const [namespace, setNamespace] = useState('')
  const [snapshotName, setSnapshotName] = useState('')
  const [createNamedSnapshot, setCreateNamedSnapshot] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; total: number; snapshotId?: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    const detected = detectFormat(f.name)
    if (detected) setFormat(detected)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  // Step 2 → 3: parse and build preview
  const buildPreview = useCallback(async () => {
    if (!file || !format) return

    const content = await file.text()
    let keys: Record<string, string> = {}

    if (format === 'json') keys = parseJSON(content).keys
    else if (format === 'arb') keys = parseARB(content).keys
    else if (format === 'yaml') keys = parseYAML(content).keys
    else if (format === 'csv') {
      const locale = project.locales.find((l) => l.id === localeId)
      const results = parseCSV(content)
      const matching = results.find((r) => r.locale === locale?.code) ?? results[0]
      keys = matching?.keys ?? {}
    }

    // Apply namespace prefix
    if (namespace.trim()) {
      const prefixed: Record<string, string> = {}
      for (const [k, v] of Object.entries(keys)) {
        prefixed[`${namespace.trim()}.${k}`] = v
      }
      keys = prefixed
    }

    // All keys are "new" for preview (we don't know existing state client-side)
    const rows: PreviewRow[] = Object.entries(keys).slice(0, 200).map(([key, value]) => ({
      key, value, conflict: 'new' as const,
    }))

    setPreview(rows)
    setStep(2)
  }, [file, format, namespace, localeId, project.locales])

  const handleImport = async () => {
    if (!file || !format || !localeId) return
    setStep(3)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('projectId', project.id)
      fd.append('localeId', localeId)
      fd.append('format', format)
      if (branchId) fd.append('branchId', branchId)
      if (createNamedSnapshot && snapshotName) {
        fd.append('snapshotName', snapshotName)
      }

      const resp = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await resp.json() as { data?: typeof result; error?: string }

      if (!resp.ok) {
        toast.error(data.error ?? 'Import failed')
        setStep(2)
        return
      }

      setResult(data.data ?? null)
      setStep(4)
    } catch {
      toast.error('Network error')
      setStep(2)
    }
  }

  const selectedLocale = project.locales.find((l) => l.id === localeId)

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
            <div className="space-y-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={[
                  'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
                  dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-zinc-700 hover:border-zinc-500',
                ].join(' ')}
              >
                <Upload className="h-8 w-8 mx-auto text-zinc-500 mb-3" />
                <p className="text-sm text-zinc-300 mb-1">Drop file here or click to browse</p>
                <p className="text-xs text-zinc-600">Supports JSON, ARB, CSV, YAML</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.arb,.csv,.yaml,.yml"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>

              {file && (
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                  <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{file.name}</p>
                    <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB · {format ? FORMAT_LABELS[format] : 'Unknown format'}</p>
                  </div>
                  {format && (
                    <Button size="sm" className="h-7 text-xs" onClick={() => setStep(1)}>
                      Continue <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Configure */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Format</label>
                <div className="flex gap-2">
                  {(['json', 'arb', 'csv', 'yaml'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={[
                        'px-3 py-1.5 text-xs rounded border transition-colors',
                        format === f ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600',
                      ].join(' ')}
                    >
                      {FORMAT_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Target locale</label>
                <select
                  value={localeId}
                  onChange={(e) => setLocaleId(e.target.value)}
                  className="w-full text-sm bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-zinc-200"
                >
                  {project.locales.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Key namespace prefix <span className="text-zinc-600">(optional)</span></label>
                <Input
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  placeholder="e.g. onboarding → keys become onboarding.key_name"
                  className="text-sm bg-zinc-900 border-zinc-700 font-mono"
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" size="sm" className="border-zinc-700" onClick={() => setStep(0)}>Back</Button>
                <Button size="sm" onClick={buildPreview} disabled={!format || !localeId}>
                  Preview <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400">{preview.length} keys found</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">Target: <span className="text-zinc-200">{selectedLocale?.name}</span></span>
              </div>

              {/* Auto-snapshot notice */}
              <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3">
                <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-xs text-blue-300">⚡ An auto-snapshot will be created before import</p>
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

              {/* Preview table */}
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_64px] text-[11px] text-zinc-500 uppercase bg-zinc-900/60 px-3 py-2 gap-3 border-b border-zinc-800">
                  <div>Key</div>
                  <div>Value</div>
                  <div>Status</div>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/60">
                  {preview.slice(0, 100).map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_64px] px-3 py-2 gap-3 text-xs hover:bg-zinc-900/40">
                      <span className="font-mono text-zinc-300 truncate">{row.key}</span>
                      <span className="text-zinc-400 truncate">{row.value}</span>
                      <span className="text-blue-400 text-[10px]">🔵 New</span>
                    </div>
                  ))}
                  {preview.length > 100 && (
                    <div className="px-3 py-2 text-xs text-zinc-600">… and {preview.length - 100} more</div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" size="sm" className="border-zinc-700" onClick={() => setStep(1)}>Back</Button>
                <Button size="sm" onClick={handleImport}>
                  Import {preview.length} keys <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 3 && (
            <div className="text-center py-16 space-y-4">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-zinc-300">Importing translations…</p>
              <p className="text-xs text-zinc-600">Creating auto-snapshot first, then importing keys</p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && result && (
            <div className="text-center py-12 space-y-6">
              <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
                <Check className="h-7 w-7 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-1">Import complete!</h3>
                <p className="text-sm text-zinc-400">
                  {result.created} new keys · {result.updated} updated · {result.total} total
                </p>
                {result.snapshotId && (
                  <p className="text-xs text-zinc-600 mt-1">Auto-snapshot created before import</p>
                )}
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" size="sm" className="border-zinc-700" onClick={() => { setStep(0); setFile(null); setPreview([]); setResult(null) }}>
                  Import Another
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
