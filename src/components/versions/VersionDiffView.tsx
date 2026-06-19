'use client'

import { useState, useEffect, useMemo } from 'react'
import { ArrowLeftRight, ChevronDown, ChevronRight, RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { VersionWithStats } from '@/lib/versions/snapshot'
import type { DiffEntry, DiffType } from '@/lib/versions/diff'

interface Props {
  projectId: string
  versionA: VersionWithStats
  versions: VersionWithStats[]
  onRestored?: () => void
}

const TYPE_STYLES: Record<DiffType, { row: string; label: string; dot: string }> = {
  changed:   { row: 'border-l-2 border-yellow-500 bg-yellow-500/5', label: 'changed', dot: 'bg-yellow-400' },
  added:     { row: 'border-l-2 border-green-500 bg-green-500/5',   label: 'added',   dot: 'bg-green-400'  },
  removed:   { row: 'border-l-2 border-red-500 bg-red-500/5',       label: 'removed', dot: 'bg-red-400'    },
  unchanged: { row: '',                                               label: 'same',    dot: 'bg-zinc-600'   },
}

const LOCALE_FLAGS: Record<string, string> = {
  en: '🇺🇸', vi: '🇻🇳', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳',
  fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸', pt: '🇧🇷', th: '🇹🇭', id: '🇮🇩',
}

function RestoreDialog({
  version,
  projectId,
  locales,
  onClose,
  onRestored,
}: {
  version: VersionWithStats
  projectId: string
  locales: string[]
  onClose: () => void
  onRestored: () => void
}) {
  const [scope, setScope] = useState<'all' | 'locale'>('all')
  const [localeCode, setLocaleCode] = useState(locales[0] ?? '')
  const [createBackup, setCreateBackup] = useState(true)
  const [restoring, setRestoring] = useState(false)

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const resp = await fetch(`/api/versions/${version.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          scope,
          localeCode: scope === 'locale' ? localeCode : undefined,
          createBackupFirst: createBackup,
        }),
      })
      const data = await resp.json() as { data?: { restored: number; skipped: number; backupVersionId?: string }; error?: string }
      if (!resp.ok) { toast.error(data.error ?? 'Restore failed'); return }
      const { restored, skipped } = data.data!
      toast.success(`Restored ${restored} translations${skipped > 0 ? ` (${skipped} skipped)` : ''}`)
      onRestored()
      onClose()
    } catch {
      toast.error('Network error')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-md p-6 shadow-2xl space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-1">Restore to &ldquo;{version.name}&rdquo;</h3>
          <p className="text-xs text-zinc-500">This will overwrite current translations.</p>
        </div>

        {/* Scope */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400">Scope</label>
          <div className="flex gap-2">
            {(['all', 'locale'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={[
                  'flex-1 py-2 text-xs rounded border transition-colors capitalize',
                  scope === s
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-600',
                ].join(' ')}
              >
                {s === 'all' ? 'All locales' : 'Specific locale'}
              </button>
            ))}
          </div>
          {scope === 'locale' && (
            <select
              value={localeCode}
              onChange={(e) => setLocaleCode(e.target.value)}
              className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200"
            >
              {locales.map((l) => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </select>
          )}
        </div>

        {/* Backup toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={['w-8 h-4 rounded-full transition-colors relative', createBackup ? 'bg-blue-600' : 'bg-zinc-700'].join(' ')}
            onClick={() => setCreateBackup((v) => !v)}
          >
            <span className={['absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all', createBackup ? 'left-[18px]' : 'left-0.5'].join(' ')} />
          </div>
          <span className="text-xs text-zinc-300">Create backup snapshot first</span>
        </label>

        {createBackup && (
          <p className="text-[11px] text-zinc-500 bg-zinc-800/50 rounded px-3 py-2 border border-zinc-700">
            ⚡ An &ldquo;Auto: Before restoring snapshot&rdquo; snapshot will be created automatically.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" className="border-zinc-700 flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1" onClick={handleRestore} disabled={restoring}>
            {restoring ? 'Restoring…' : 'Restore'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function VersionDiffView({ projectId, versionA, versions, onRestored }: Props) {
  const [compareWithId, setCompareWithId] = useState<string>('current')
  const [diff, setDiff] = useState<DiffEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterLocale, setFilterLocale] = useState('all')
  const [filterType, setFilterType] = useState<'all' | DiffType>('all')
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/versions/${versionA.id}?compareWith=${compareWithId}&projectId=${projectId}`)
      .then((r) => r.json())
      .then((d: { data?: { version: VersionWithStats; diff: DiffEntry[] } }) => {
        setDiff(d.data?.diff ?? [])
      })
      .catch(() => toast.error('Failed to load diff'))
      .finally(() => setLoading(false))
  }, [versionA.id, compareWithId, projectId])

  const locales = useMemo(() => {
    const set = new Set(diff.map((d) => d.locale_code))
    return Array.from(set).sort()
  }, [diff])

  const filtered = useMemo(() => {
    return diff.filter((entry) => {
      if (entry.type === 'unchanged' && !showUnchanged) return false
      if (filterType !== 'all' && entry.type !== filterType) return false
      if (filterLocale !== 'all' && entry.locale_code !== filterLocale) return false
      if (search) {
        const q = search.toLowerCase()
        if (!entry.key_name.toLowerCase().includes(q) &&
            !(entry.valueA ?? '').toLowerCase().includes(q) &&
            !(entry.valueB ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [diff, filterType, filterLocale, search, showUnchanged])

  const summary = useMemo(() => ({
    changed: diff.filter((d) => d.type === 'changed').length,
    added: diff.filter((d) => d.type === 'added').length,
    removed: diff.filter((d) => d.type === 'removed').length,
    unchanged: diff.filter((d) => d.type === 'unchanged').length,
  }), [diff])

  const compareVersion = versions.find((v) => v.id === compareWithId)
  const compareName = compareWithId === 'current' ? 'Current State' : (compareVersion?.name ?? compareWithId)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* Controls bar */}
      <div className="px-5 py-3 border-b border-zinc-800 space-y-2 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <span className="text-zinc-500 text-xs truncate max-w-[140px]">{versionA.name}</span>
            <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-500" />
            <select
              value={compareWithId}
              onChange={(e) => setCompareWithId(e.target.value)}
              className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
            >
              <option value="current">Current State</option>
              {versions.filter((v) => v.id !== versionA.id).map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 h-7 text-xs gap-1.5"
              onClick={() => setShowRestoreDialog(true)}
            >
              <RotateCcw className="h-3 w-3" />
              Restore to {versionA.name}
            </Button>
          </div>
        </div>

        {/* Summary chips */}
        {!loading && (
          <div className="flex items-center gap-2 flex-wrap">
            {(['changed', 'added', 'removed', 'unchanged'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(filterType === type ? 'all' : type)}
                className={[
                  'flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                  filterType === type
                    ? 'bg-zinc-700 border-zinc-500 text-zinc-200'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-700',
                ].join(' ')}
              >
                <span className={['w-1.5 h-1.5 rounded-full', TYPE_STYLES[type].dot].join(' ')} />
                {summary[type]} {type}
              </button>
            ))}
          </div>
        )}

        {/* Filters row */}
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keys…"
              className="pl-7 h-7 text-xs bg-zinc-900 border-zinc-700"
            />
          </div>
          <select
            value={filterLocale}
            onChange={(e) => setFilterLocale(e.target.value)}
            className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
          >
            <option value="all">All locales</option>
            {locales.map((l) => (
              <option key={l} value={l}>{l.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Diff table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-zinc-800/40 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">
            {diff.length === 0 ? `No differences between ${versionA.name} and ${compareName}` : 'No results match your filter'}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 grid grid-cols-[1fr_160px_1fr_1fr] gap-3 px-5 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
              <div>Key</div>
              <div>Locale</div>
              <div>{versionA.name}</div>
              <div>{compareName}</div>
            </div>

            {filtered
              .filter((e) => e.type !== 'unchanged')
              .map((entry, i) => (
                <DiffRow key={`${entry.key_name}:${entry.locale_code}:${i}`} entry={entry} />
              ))}

            {/* Unchanged toggle */}
            {summary.unchanged > 0 && (
              <div className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => setShowUnchanged((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showUnchanged ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {showUnchanged ? 'Hide' : 'Show'} {summary.unchanged} unchanged
                </button>

                {showUnchanged && filtered
                  .filter((e) => e.type === 'unchanged')
                  .map((entry, i) => (
                    <DiffRow key={`unch:${entry.key_name}:${entry.locale_code}:${i}`} entry={entry} />
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {showRestoreDialog && (
        <RestoreDialog
          version={versionA}
          projectId={projectId}
          locales={locales}
          onClose={() => setShowRestoreDialog(false)}
          onRestored={() => { onRestored?.(); setShowRestoreDialog(false) }}
        />
      )}
    </div>
  )
}

function DiffRow({ entry }: { entry: DiffEntry }) {
  const style = TYPE_STYLES[entry.type]
  return (
    <div className={['grid grid-cols-[1fr_160px_1fr_1fr] gap-3 px-5 py-2.5 border-b border-zinc-800/60', style.row].join(' ')}>
      <div className="font-mono text-xs text-zinc-200 truncate self-center">{entry.key_name}</div>
      <div className="flex items-center gap-1.5 self-center">
        <span className="text-base">{LOCALE_FLAGS[entry.locale_code] ?? '🌐'}</span>
        <span className="text-[11px] font-medium text-zinc-400 uppercase">{entry.locale_code}</span>
      </div>
      <div className="text-xs self-center">
        {entry.type === 'added' ? (
          <span className="text-zinc-600 italic">—</span>
        ) : (
          <span className={entry.type === 'changed' ? 'text-zinc-500 line-through' : 'text-zinc-300'}>
            {entry.valueA ?? <span className="text-zinc-600 italic">empty</span>}
          </span>
        )}
      </div>
      <div className="text-xs self-center">
        {entry.type === 'removed' ? (
          <span className="text-zinc-600 italic">—</span>
        ) : (
          <span className={entry.type === 'changed' ? 'text-green-300' : 'text-zinc-300'}>
            {entry.valueB ?? <span className="text-zinc-600 italic">empty</span>}
          </span>
        )}
      </div>
    </div>
  )
}
