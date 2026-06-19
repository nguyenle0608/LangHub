'use client'

import { useState, useRef, useMemo, useCallback, Fragment } from 'react'
import Link from 'next/link'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Search, Plus, Download, Upload, ChevronRight,
  Sparkles, LogOut,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TranslationCell } from './TranslationCell'
import { StatusBadge } from './StatusBadge'
import { BulkActionBar } from './BulkActionBar'
import { AddKeySheet } from './AddKeySheet'
import { KeyDetailPanel } from './KeyDetailPanel'
import { useRealtime } from '@/hooks/useRealtime'
import { usePresence } from '@/hooks/usePresence'
import type { ProjectWithStats } from '@/types'
import type { KeyWithTranslations } from '@/lib/supabase/queries/translations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  project: ProjectWithStats
  initialKeys: KeyWithTranslations[]
  user: { id: string; email?: string | undefined }
}

type FilterStatus = 'all' | 'empty' | 'pending' | 'reviewed' | 'approved'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOCALE_FLAGS: Record<string, string> = {
  en: '🇺🇸', vi: '🇻🇳', ja: '🇯🇵', ko: '🇰🇷',
  zh: '🇨🇳', fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸',
  pt: '🇧🇷', th: '🇹🇭', id: '🇮🇩',
}

function getFlag(code: string): string {
  return LOCALE_FLAGS[code] ?? '🌐'
}

function keyOverallStatus(key: KeyWithTranslations, localeCount: number): string {
  if (key.translations.length === 0) return 'empty'
  const filled = key.translations.filter((t) => t.value && t.value.trim())
  if (filled.length === 0) return 'empty'
  if (filled.length < localeCount) return 'pending'
  if (filled.every((t) => t.status === 'approved')) return 'approved'
  if (filled.some((t) => t.status === 'reviewed')) return 'reviewed'
  return 'pending'
}

// ---------------------------------------------------------------------------
// Main TranslationTable
// ---------------------------------------------------------------------------

export function TranslationTable({ project, initialKeys, user }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // State
  const [keys, setKeys] = useState(initialKeys)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showAddKey, setShowAddKey] = useState(false)
  const [selectedLocaleId, setSelectedLocaleId] = useState<string | null>(null)

  // Sorted locales: base first
  const locales = useMemo(() => {
    const base = project.locales.filter((l) => l.is_base)
    const rest = project.locales.filter((l) => !l.is_base)
    return [...base, ...rest]
  }, [project.locales])

  // Filtered keys
  const filteredKeys = useMemo(() => {
    let result = keys

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (k) =>
          k.key.toLowerCase().includes(q) ||
          (k.description ?? '').toLowerCase().includes(q) ||
          k.translations.some((t) => (t.value ?? '').toLowerCase().includes(q))
      )
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'empty') {
        result = result.filter((k) => k.translations.some((t) => !t.value || t.status === 'empty'))
      } else {
        result = result.filter((k) => k.translations.some((t) => t.status === filterStatus))
      }
    }

    if (selectedLocaleId) {
      result = result.filter((k) => k.translations.some((t) => t.locale_id === selectedLocaleId))
    }

    return result
  }, [keys, search, filterStatus, selectedLocaleId])

  // Stats
  const stats = useMemo(() => {
    const all = keys.flatMap((k) => k.translations)
    return {
      total: keys.length,
      approved: all.filter((t) => t.status === 'approved').length,
      pending: all.filter((t) => t.status === 'pending').length,
      reviewed: all.filter((t) => t.status === 'reviewed').length,
      empty: all.filter((t) => !t.value || t.status === 'empty').length,
    }
  }, [keys])

  // Overall %
  const overallPercent = useMemo(() => {
    const total = keys.flatMap((k) => k.translations).length
    if (total === 0) return 0
    return Math.round((stats.approved / total) * 100)
  }, [keys, stats.approved])

  // Realtime
  const keyIds = useMemo(() => keys.map((k) => k.id), [keys])

  const handleRealtimeUpdate = useCallback(
    (update: {
      id: string
      key_id: string | null
      locale_id: string | null
      value: string | null
      status: string | null
      updated_at: string | null
    }) => {
      setKeys((prev) =>
        prev.map((k) => {
          if (k.id !== update.key_id) return k
          return {
            ...k,
            translations: k.translations.map((t) =>
              t.id === update.id
                ? { ...t, value: update.value, status: update.status, updated_at: update.updated_at }
                : t
            ),
          }
        })
      )
    },
    []
  )

  useRealtime({ keyIds, onUpdate: handleRealtimeUpdate })
  const { presences, trackCell } = usePresence(project.id, user)

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: filteredKeys.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 8,
  })

  // Cell editing
  const startEdit = useCallback(
    (keyId: string, localeId: string, currentValue: string) => {
      setEditingCell(`${keyId}:${localeId}`)
      setEditValue(currentValue)
      void trackCell(keyId, localeId)
    },
    [trackCell]
  )

  const saveCell = useCallback(
    async (keyId: string, localeId: string) => {
      const cellId = `${keyId}:${localeId}`
      setSavingCell(cellId)
      setEditingCell(null)

      const value = editValue
      const status = value.trim() ? 'pending' : 'empty'

      // Optimistic update
      setKeys((prev) =>
        prev.map((k) => {
          if (k.id !== keyId) return k
          return {
            ...k,
            translations: k.translations.map((t) =>
              t.locale_id === localeId ? { ...t, value, status } : t
            ),
          }
        })
      )

      try {
        const resp = await fetch('/api/translations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyId, localeId, value, status }),
        })
        if (!resp.ok) {
          toast.error('Failed to save translation')
        }
      } catch {
        toast.error('Network error')
      } finally {
        setSavingCell(null)
        void trackCell(null, null)
      }
    },
    [editValue, trackCell]
  )

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
    void trackCell(null, null)
  }, [trackCell])

  // Row selection
  const toggleRow = useCallback((keyId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(keyId)) next.delete(keyId)
      else next.add(keyId)
      return next
    })
  }, [])

  const toggleAllRows = useCallback(() => {
    if (selectedRows.size === filteredKeys.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredKeys.map((k) => k.id)))
    }
  }, [filteredKeys, selectedRows.size])

  // Add key
  const handleKeyCreated = useCallback(
    (newKey: KeyWithTranslations) => {
      setKeys((prev) => [newKey, ...prev])
      setShowAddKey(false)
    },
    []
  )

  // Key detail panel updates
  const handleKeyUpdated = useCallback((keyId: string, patch: Partial<KeyWithTranslations>) => {
    setKeys((prev) => prev.map((k) => k.id === keyId ? { ...k, ...patch } : k))
  }, [])

  const handleKeyDeleted = useCallback((keyId: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== keyId))
    setSelectedKeyId(null)
  }, [])

  // Bulk operations
  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedRows)
    // Delete all selected keys
    await Promise.all(ids.map((id) =>
      fetch(`/api/keys/${id}`, { method: 'DELETE' })
    ))
    setKeys((prev) => prev.filter((k) => !selectedRows.has(k.id)))
    setSelectedRows(new Set())
    toast.success(`Deleted ${ids.length} key${ids.length > 1 ? 's' : ''}`)
  }, [selectedRows])

  const handleBulkApprove = useCallback(async () => {
    const ids = Array.from(selectedRows)
    // Approve all translations for selected keys (each locale)
    await Promise.all(
      ids.flatMap((keyId) =>
        locales.map(async (locale) => {
          const key = keys.find((k) => k.id === keyId)
          const t = key?.translations.find((tr) => tr.locale_id === locale.id)
          if (!t?.value) return
          await fetch('/api/translations', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyId, localeId: locale.id, value: t.value, status: 'approved' }),
          })
        })
      )
    )
    setKeys((prev) =>
      prev.map((k) => {
        if (!selectedRows.has(k.id)) return k
        return {
          ...k,
          translations: k.translations.map((t) =>
            t.value ? { ...t, status: 'approved' } : t
          ),
        }
      })
    )
    setSelectedRows(new Set())
    toast.success(`Approved ${ids.length} key${ids.length > 1 ? 's' : ''}`)
  }, [selectedRows, locales, keys])

  // Column layout
  const COLS = {
    check: 40,
    key: 224,
    locale: 200,
    status: 88,
  }
  const gridCols = `${COLS.check}px ${COLS.key}px ${locales.map(() => `${COLS.locale}px`).join(' ')} ${COLS.status}px`

  // Presence lookup for cells
  const presenceCellMap = useMemo(() => {
    const map = new Map<string, string>() // "keyId:localeId" → color
    for (const p of presences) {
      if (p.keyId && p.localeId) {
        map.set(`${p.keyId}:${p.localeId}`, p.color)
      }
    }
    return map
  }, [presences])

  const selectedKey = keys.find((k) => k.id === selectedKeyId)

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-zinc-100 overflow-hidden">
      {/* ── TopNav ── */}
      <header className="h-12 border-b border-zinc-800 flex items-center px-4 gap-3 flex-shrink-0 bg-[#0d1117]">
        <Link href="/projects" className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors">
          <span className="font-bold text-blue-500 text-sm">LH</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
        <span className="text-sm text-zinc-400 truncate max-w-[140px]">{project.name}</span>
        <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
        <span className="text-sm text-zinc-200">Editor</span>

        <div className="flex-1" />

        {/* Progress */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400">
          <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          <span>{overallPercent}%</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Link href={`/${project.id}/keys`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100">
              <span className="hidden md:inline">Duplicates</span>
            </Button>
          </Link>
          <Link href={`/${project.id}/versions`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100">
              <span className="hidden md:inline">Versions</span>
            </Button>
          </Link>
          <Link href={`/${project.id}/import`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100">
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Import</span>
            </Button>
          </Link>
          <Link href={`/${project.id}/export`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Export</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 text-zinc-600 cursor-not-allowed"
            onClick={() => toast.info('AI Translation — Coming Soon')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden md:inline">AI Translate</span>
          </Button>
          <Link href="/projects">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-100">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="h-11 border-b border-zinc-800 flex items-center px-4 gap-2 flex-shrink-0 bg-[#0d1117]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keys or values…"
            className="h-7 pl-8 pr-3 text-xs w-56 bg-zinc-900 border-zinc-700 placeholder:text-zinc-600"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1">
          {([
            { value: 'all', label: 'All' },
            { value: 'empty', label: 'Untranslated' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
          ] as { value: FilterStatus; label: string }[]).map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={cn(
                'px-2.5 h-7 text-xs rounded transition-colors',
                filterStatus === f.value
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              )}
            >
              {f.label}
              {f.value === 'empty' && stats.empty > 0 && (
                <span className="ml-1 text-amber-400">{stats.empty}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <Button
          size="sm"
          className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setShowAddKey(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Key
        </Button>
      </div>

      {/* ── StatsBar ── */}
      <div className="h-8 border-b border-zinc-800 flex items-center px-4 gap-4 flex-shrink-0 bg-[#0d1117]">
        <span className="text-xs text-zinc-500">
          <span className="text-zinc-300 font-medium">{filteredKeys.length}</span>
          {filteredKeys.length !== stats.total && (
            <span className="text-zinc-600"> of {stats.total}</span>
          )}{' '}
          keys
        </span>
        <span className="text-zinc-700">·</span>
        <span className="text-xs text-zinc-500">
          <span className="text-emerald-400 font-medium">{stats.approved}</span> approved
        </span>
        <span className="text-zinc-700">·</span>
        <span className="text-xs text-zinc-500">
          <span className="text-amber-400 font-medium">{stats.empty}</span> untranslated
        </span>
        <span className="text-zinc-700">·</span>
        <span className="text-xs text-zinc-500">
          <span className="text-blue-400 font-medium">{stats.pending}</span> pending
        </span>
      </div>

      {/* ── Presence bar ── */}
      {presences.length > 0 && (
        <div className="h-7 border-b border-zinc-800/50 bg-blue-950/30 flex items-center px-4 gap-2 flex-shrink-0">
          <div className="flex -space-x-1">
            {presences.slice(0, 4).map((p) => (
              <div
                key={p.userId}
                className="w-4 h-4 rounded-full border border-zinc-900 flex items-center justify-center text-[8px] font-bold"
                style={{ backgroundColor: p.color }}
                title={p.email}
              >
                {(p.email[0] ?? '?').toUpperCase()}
              </div>
            ))}
          </div>
          <span className="text-xs text-blue-300/70">
            {presences[0]?.email} is editing
          </span>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-52 border-r border-zinc-800 flex flex-col flex-shrink-0 overflow-y-auto bg-zinc-950">
          <div className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2 px-1">Filters</div>
            {([
              { id: 'all', label: 'All Keys', count: stats.total },
              { id: 'empty', label: 'Untranslated', count: stats.empty },
              { id: 'pending', label: 'Pending', count: stats.pending },
              { id: 'reviewed', label: 'Reviewed', count: stats.reviewed },
              { id: 'approved', label: 'Approved', count: stats.approved },
            ] as { id: FilterStatus; label: string; count: number }[]).map((item) => (
              <button
                key={item.id}
                onClick={() => { setFilterStatus(item.id); setSelectedLocaleId(null) }}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors',
                  filterStatus === item.id && !selectedLocaleId
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                )}
              >
                <span>{item.label}</span>
                {item.count > 0 && (
                  <span className={cn(
                    'text-[10px] px-1 rounded',
                    item.id === 'empty' ? 'text-amber-400' : 'text-zinc-600'
                  )}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-zinc-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2 px-1">Languages</div>
            {locales.map((locale) => (
              <button
                key={locale.id}
                onClick={() => {
                  setSelectedLocaleId(selectedLocaleId === locale.id ? null : locale.id)
                  setFilterStatus('all')
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                  selectedLocaleId === locale.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                )}
              >
                <span>{getFlag(locale.code)}</span>
                <span className="flex-1 text-left">{locale.name}</span>
                <span className={cn(
                  'text-[10px] font-medium px-1 rounded',
                  locale.percent >= 80 ? 'text-emerald-400' :
                  locale.percent >= 50 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {locale.percent}%
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Table */}
        <div className={cn('flex flex-1 overflow-hidden', selectedKeyId && 'mr-0')}>
          <div ref={scrollRef} className="flex-1 overflow-auto">
            {/* Sticky header */}
            <div
              className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 grid min-w-max"
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Checkbox */}
              <div className="flex items-center justify-center h-9">
                <input
                  type="checkbox"
                  checked={selectedRows.size === filteredKeys.length && filteredKeys.length > 0}
                  onChange={toggleAllRows}
                  className="accent-blue-500 cursor-pointer"
                />
              </div>
              {/* Key */}
              <div className="px-3 flex items-center h-9 text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Key
              </div>
              {/* Locale columns */}
              {locales.map((locale) => (
                <div
                  key={locale.id}
                  className="px-3 flex items-center h-9 gap-1.5 text-xs font-medium text-zinc-400"
                >
                  <span>{getFlag(locale.code)}</span>
                  <span className="uppercase">{locale.code}</span>
                  {locale.is_base && (
                    <span className="text-[9px] text-zinc-600 border border-zinc-700 rounded px-0.5">base</span>
                  )}
                  <span className={cn(
                    'ml-auto text-[10px]',
                    locale.percent >= 80 ? 'text-emerald-500' :
                    locale.percent >= 50 ? 'text-amber-500' : 'text-red-500'
                  )}>
                    {locale.percent}%
                  </span>
                </div>
              ))}
              {/* Status */}
              <div className="px-3 flex items-center h-9 text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Status
              </div>
            </div>

            {/* Empty state */}
            {filteredKeys.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                <p className="text-sm">
                  {keys.length === 0
                    ? 'No keys yet — add your first key'
                    : 'No keys match your filters'}
                </p>
                {keys.length === 0 && (
                  <Button
                    size="sm"
                    className="mt-4 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowAddKey(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Key
                  </Button>
                )}
              </div>
            )}

            {/* Virtual rows */}
            {filteredKeys.length > 0 && (
              <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const keyItem = filteredKeys[virtualRow.index]
                  if (!keyItem) return null
                  const isSelected = selectedRows.has(keyItem.id)
                  const isActive = selectedKeyId === keyItem.id

                  return (
                    <div
                      key={virtualRow.key}
                      className={cn(
                        'absolute inset-x-0 grid border-b border-zinc-800/50 min-w-max',
                        'transition-colors cursor-default',
                        isActive ? 'bg-zinc-800/60' : 'hover:bg-zinc-900/60',
                        isSelected && 'bg-blue-950/30'
                      )}
                      style={{
                        top: 0,
                        transform: `translateY(${virtualRow.start}px)`,
                        height: `${virtualRow.size}px`,
                        gridTemplateColumns: gridCols,
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className="flex items-center justify-center"
                        onClick={(e) => toggleRow(keyItem.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => undefined}
                          className="accent-blue-500 cursor-pointer"
                        />
                      </div>

                      {/* Key name */}
                      <div
                        className="px-3 flex flex-col justify-center cursor-pointer"
                        onClick={() => setSelectedKeyId(isActive ? null : keyItem.id)}
                      >
                        <span className="font-mono text-xs text-zinc-200 truncate">{keyItem.key}</span>
                        {keyItem.description && (
                          <span className="text-[10px] text-zinc-600 truncate">{keyItem.description}</span>
                        )}
                      </div>

                      {/* Translation cells */}
                      {locales.map((locale) => {
                        const t = keyItem.translations.find((tr) => tr.locale_id === locale.id)
                        const cellId = `${keyItem.id}:${locale.id}`
                        const isEditingThis = editingCell === cellId
                        const isSavingThis = savingCell === cellId
                        const presenceColor = presenceCellMap.get(cellId)

                        return (
                          <Fragment key={locale.id}>
                            <TranslationCell
                              value={t?.value ?? null}
                              charLimit={keyItem.char_limit}
                              isEditing={isEditingThis}
                              isSaving={isSavingThis}
                              editValue={editValue}
                              presenceColor={presenceColor}
                              onEditValueChange={setEditValue}
                              onStartEdit={() => {
                                setSelectedKeyId(keyItem.id)
                                startEdit(keyItem.id, locale.id, t?.value ?? '')
                              }}
                              onSave={() => void saveCell(keyItem.id, locale.id)}
                              onCancel={cancelEdit}
                            />
                          </Fragment>
                        )
                      })}

                      {/* Status */}
                      <div className="px-3 flex items-center">
                        <StatusBadge
                          status={keyOverallStatus(keyItem, locales.length)}
                          size="xs"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right panel */}
          {selectedKeyId && (
            <KeyDetailPanel
              keyItem={selectedKey}
              locales={locales}
              userId={user.id}
              onClose={() => setSelectedKeyId(null)}
              onKeyUpdated={(patch) => handleKeyUpdated(selectedKeyId, patch)}
              onKeyDeleted={handleKeyDeleted}
            />
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedRows.size > 0 && (
        <BulkActionBar
          selectedCount={selectedRows.size}
          projectId={project.id}
          onClear={() => setSelectedRows(new Set())}
          onDelete={handleBulkDelete}
          onApprove={handleBulkApprove}
        />
      )}

      {/* Add Key sheet */}
      <AddKeySheet
        open={showAddKey}
        projectId={project.id}
        locales={locales}
        existingKeys={keys.map((k) => k.key)}
        onClose={() => setShowAddKey(false)}
        onCreated={handleKeyCreated}
      />
    </div>
  )
}
