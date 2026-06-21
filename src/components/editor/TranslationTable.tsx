'use client'

import { useState, useRef, useMemo, useCallback, Fragment, useEffect } from 'react'
import Link from 'next/link'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Search, Plus, Download, Upload,
  Sparkles, LogOut, ListFilter, Layers2, ChevronDown,
  Columns3, Eye, EyeOff, Pin, PinOff, Lock, Unlock, GripVertical, Undo2, Redo2,
  MoreHorizontal, Copy, History, Globe2, GitBranch as GitBranchIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TranslationCell } from './TranslationCell'
import { StatusBadge } from './StatusBadge'
import { BulkActionBar } from './BulkActionBar'
import { BranchSwitcher } from './BranchSwitcher'
import { MergeDialog } from './MergeDialog'
import { AddKeySheet } from './AddKeySheet'
import { KeyDetailPanel } from './KeyDetailPanel'
import { ManageLocalesDialog } from './ManageLocalesDialog'
import { ExportSheet } from '@/components/export/ExportSheet'
import { useRealtime } from '@/hooks/useRealtime'
import { usePresence } from '@/hooks/usePresence'
import type { ProjectWithStats, MemberRole } from '@/types'
import type { KeyWithTranslations } from '@/lib/supabase/queries/translations'
import type { Branch } from '@/lib/branches/queries'
import { localeFlag as getFlag } from '@/lib/locale-flag'
import { signOut } from '@/lib/supabase/auth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  project: ProjectWithStats
  initialKeys: KeyWithTranslations[]
  branches: Branch[]
  activeBranchId: string
  user: { id: string; email?: string | undefined; role: MemberRole }
}

type FilterStatus = 'all' | 'empty' | 'pending' | 'reviewed' | 'approved'

type VirtualRow =
  | { type: 'group'; fullPath: string; label: string; depth: number; count: number }
  | { type: 'key'; item: KeyWithTranslations; depth: number }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function keyOverallStatus(
  key: KeyWithTranslations,
  locales: ProjectWithStats['locales'],
): string {
  const targetLocales = locales.filter((l) => !l.is_base)
  if (targetLocales.length === 0) return 'empty'
  const targetIds = new Set(targetLocales.map((l) => l.id))
  const targetTranslations = key.translations.filter((t) => t.locale_id && targetIds.has(t.locale_id))
  const filled = targetTranslations.filter((t) => t.value && t.value.trim())
  if (filled.length === 0) return 'empty'
  if (filled.length < targetLocales.length) return 'pending'
  if (filled.every((t) => t.status === 'approved')) return 'approved'
  if (filled.some((t) => t.status === 'reviewed')) return 'reviewed'
  return 'pending'
}

// A cell coordinate in the selectable grid: row = index over visible key rows,
// col = index over visibleLocales.
type Cell = { row: number; col: number }

// One cell's value/status transition, for undo/redo history.
type CellState = { value: string; status: string }
type CellChange = { keyId: string; localeId: string; before: CellState; after: CellState }

// Parse clipboard text (TSV from Excel/Sheets) into a 2D grid.
// Handles double-quoted fields with embedded tabs/newlines and "" escapes.
function parseClipboardTable(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === '\t') { row.push(field); field = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += ch; i++
  }
  row.push(field); rows.push(row)
  // Drop a trailing empty row produced by a final newline
  const last = rows[rows.length - 1]
  if (last && last.length === 1 && last[0] === '') rows.pop()
  return rows
}

// Generate a deterministic HSL color from a string (for user avatars).
function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 55%, 40%)`
}

// Serialize a 2D grid to TSV, quoting cells that contain tab/newline/quote.
function serializeClipboardTable(grid: string[][]): string {
  return grid
    .map((r) => r.map((cell) => (/[\t\n\r"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join('\t'))
    .join('\n')
}

// ---------------------------------------------------------------------------
// Main TranslationTable
// ---------------------------------------------------------------------------

export function TranslationTable({ project, initialKeys, branches: initialBranches, activeBranchId: initialBranchId, user }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Role-based permissions
  const canEdit = user.role !== 'viewer'         // edit translation content
  const canSelect = user.role !== 'viewer'       // can select rows (checkbox visible)
  const canReview = user.role !== 'viewer'       // can review / approve translations
  const canManage = user.role === 'owner' || user.role === 'admin'  // import, add key, manage locales
  const canEditKeys = user.role === 'owner'      // rename / delete keys

  // State
  const [keys, setKeys] = useState(initialKeys)
  // Branch state — switching is client-side (no full navigation) so column
  // layout and other UI state survive; only the cell content reloads.
  const [activeBranchId, setActiveBranchId] = useState(initialBranchId)
  const [branches, setBranches] = useState(initialBranches)
  const [switchingBranch, setSwitchingBranch] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showAddKey, setShowAddKey] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<Map<string, FilterStatus>>(new Map())
  const [groupBy, setGroupBy] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  // frozenCols = sticky columns (Excel-style freeze); key is frozen by default
  const [frozenCols, setFrozenCols] = useState<Set<string>>(() => new Set(['key']))
  // lockedCols = read-only columns (no editing allowed)
  const [lockedCols, setLockedCols] = useState<Set<string>>(new Set())
  const [localeOrder, setLocaleOrder] = useState<string[]>([])
  const draggingLocaleRef = useRef<string | null>(null)
  const [dragOverLocaleId, setDragOverLocaleId] = useState<string | null>(null)
  const [selectedLocaleId, setSelectedLocaleId] = useState<string | null>(null)

  // Excel-like range selection (drag across locale cells, then copy/paste)
  const [selRange, setSelRange] = useState<{ anchor: Cell; focus: Cell } | null>(null)
  const pointerDownRef = useRef(false)
  const didDragRef = useRef(false)
  const selRangeRef = useRef(selRange)
  selRangeRef.current = selRange

  // Undo/redo history of cell value/status changes (edit, paste, clear)
  const undoRef = useRef<CellChange[][]>([])
  const redoRef = useRef<CellChange[][]>([])
  const [, setHistTick] = useState(0)
  const HISTORY_LIMIT = 200
  const pushUndo = useCallback((changes: CellChange[]) => {
    const real = changes.filter((c) => c.before.value !== c.after.value || c.before.status !== c.after.status)
    if (real.length === 0) return
    undoRef.current.push(real)
    if (undoRef.current.length > HISTORY_LIMIT) undoRef.current.shift()
    redoRef.current = []
    setHistTick((t) => t + 1)
  }, [])

  // Switch branch client-side: reload only cell content, preserve all layout.
  const handleSwitchBranch = useCallback(async (branchId: string) => {
    if (branchId === activeBranchId || switchingBranch) return
    setSwitchingBranch(true)
    try {
      const res = await fetch(`/api/keys?projectId=${project.id}&branch=${branchId}`)
      const json = await res.json() as { data?: KeyWithTranslations[]; error?: string }
      if (!res.ok || !json.data) { toast.error(json.error ?? 'Failed to load branch'); return }
      setKeys(json.data)
      setActiveBranchId(branchId)
      // Clear transient per-branch UI; keep column layout
      setSelectedRows(new Set())
      setSelectedKeyId(null)
      setEditingCell(null)
      // Update URL without a full navigation (no loading flash, no remount)
      window.history.replaceState(null, '', `/${project.id}/editor?branch=${branchId}`)
    } catch {
      toast.error('Network error')
    } finally {
      setSwitchingBranch(false)
    }
  }, [activeBranchId, switchingBranch, project.id])

  // Reload the active branch's cell content (after a merge into it, etc.)
  const reloadActiveBranch = useCallback(async () => {
    setSwitchingBranch(true)
    try {
      const res = await fetch(`/api/keys?projectId=${project.id}&branch=${activeBranchId}`)
      const json = await res.json() as { data?: KeyWithTranslations[]; error?: string }
      if (res.ok && json.data) setKeys(json.data)
    } catch {
      // leave existing keys on failure
    } finally {
      setSwitchingBranch(false)
    }
  }, [project.id, activeBranchId])

  const handleBranchCreated = useCallback((branch: Branch) => {
    setBranches((prev) => [...prev, branch])
    void handleSwitchBranch(branch.id)
  }, [handleSwitchBranch])

  const handleBranchDeleted = useCallback((branchId: string) => {
    setBranches((prev) => prev.filter((b) => b.id !== branchId))
    if (branchId === activeBranchId) {
      const main = branches.find((b) => b.is_default)
      if (main) void handleSwitchBranch(main.id)
    }
  }, [activeBranchId, branches, handleSwitchBranch])

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
      result = result.filter((k) => keyOverallStatus(k, locales) === filterStatus)
    }

    if (selectedLocaleId) {
      result = result.filter((k) => {
        const t = k.translations.find((tr) => tr.locale_id === selectedLocaleId)
        return !t?.value || t.status === 'empty' || t.status === 'pending'
      })
    }

    columnFilters.forEach((colStatus, localeId) => {
      if (colStatus === 'all') return
      result = result.filter((k) => {
        const t = k.translations.find((tr) => tr.locale_id === localeId)
        if (colStatus === 'empty') return !t?.value || t.status === 'empty'
        return t?.status === colStatus
      })
    })

    return result
  }, [keys, search, filterStatus, selectedLocaleId, columnFilters, locales])

  // Virtual rows (flat list of group headers + key rows for the virtualizer)
  const virtualRows = useMemo((): VirtualRow[] => {
    if (!groupBy) return filteredKeys.map((item) => ({ type: 'key', item, depth: 0 }))

    // Collect all unique namespace paths (all-but-last dot-segments of each key)
    const nsSet = new Set<string>()
    for (const key of filteredKeys) {
      const parts = key.key.split('.')
      for (let i = 1; i < parts.length; i++) {
        nsSet.add(parts.slice(0, i).join('.'))
      }
    }
    const sortedNs = Array.from(nsSet).sort()

    // Total key count per namespace (including sub-namespaces)
    const nsCount = new Map<string, number>()
    for (const key of filteredKeys) {
      const parts = key.key.split('.')
      for (let i = 1; i < parts.length; i++) {
        const ns = parts.slice(0, i).join('.')
        nsCount.set(ns, (nsCount.get(ns) ?? 0) + 1)
      }
    }

    // True if any ancestor namespace is collapsed
    function ancestorCollapsed(path: string): boolean {
      const parts = path.split('.')
      for (let i = 1; i < parts.length; i++) {
        if (collapsedGroups.has(parts.slice(0, i).join('.'))) return true
      }
      return false
    }

    const rows: VirtualRow[] = []
    const addedIds = new Set<string>()

    for (const ns of sortedNs) {
      if (ancestorCollapsed(ns)) continue
      const depth = ns.split('.').length - 1
      const label = ns.split('.').pop() ?? ns
      rows.push({ type: 'group', fullPath: ns, label, depth, count: nsCount.get(ns) ?? 0 })

      if (!collapsedGroups.has(ns)) {
        for (const key of filteredKeys) {
          const parts = key.key.split('.')
          if (parts.length < 2) continue
          const keyNs = parts.slice(0, -1).join('.')
          if (keyNs === ns) {
            rows.push({ type: 'key', item: key, depth: depth + 1 })
            addedIds.add(key.id)
          }
        }
      }
    }

    // Root-level keys (no dots — no namespace)
    for (const key of filteredKeys) {
      if (!addedIds.has(key.id)) {
        rows.push({ type: 'key', item: key, depth: 0 })
      }
    }

    return rows
  }, [filteredKeys, groupBy, collapsedGroups])

  // Ordered list of visible key IDs (for mapping selection row index ↔ key)
  const rowOrder = useMemo(
    () => virtualRows.filter((r): r is Extract<VirtualRow, { type: 'key' }> => r.type === 'key').map((r) => r.item.id),
    [virtualRows]
  )
  const rowIndexByKeyId = useMemo(() => {
    const m = new Map<string, number>()
    rowOrder.forEach((id, i) => m.set(id, i))
    return m
  }, [rowOrder])

  // Clear any range selection when the visible set changes (coords would be stale)
  useEffect(() => { setSelRange(null) }, [search, filterStatus, selectedLocaleId, groupBy])

  // Stats
  const stats = useMemo(() => {
    const totalKeys = keys.length
    // Key-level status counts (via keyOverallStatus, non-base only) — used in sidebar + StatsBar
    const keyCounts = { empty: 0, pending: 0, reviewed: 0, approved: 0 }
    for (const key of keys) {
      const s = keyOverallStatus(key, locales)
      if (s in keyCounts) keyCounts[s as keyof typeof keyCounts]++
    }
    // Per-locale: count of keys where that locale needs work + approved percent
    const localeNeedsWork = new Map<string, number>()
    const localePercent = new Map<string, number>()
    // Approved translation records (non-base) for progress bar
    let approvedRecords = 0
    for (const locale of locales) {
      if (locale.is_base) continue
      let needsWork = 0
      let approved = 0
      for (const key of keys) {
        const t = key.translations.find((tr) => tr.locale_id === locale.id)
        if (!t || !t.value || t.status === 'empty' || t.status === 'pending') needsWork++
        if (t?.status === 'approved') approved++
      }
      if (needsWork > 0) localeNeedsWork.set(locale.id, needsWork)
      localePercent.set(locale.id, totalKeys > 0 ? Math.round((approved / totalKeys) * 100) : 0)
      approvedRecords += approved
    }
    return {
      total: totalKeys,
      approvedRecords,
      ...keyCounts,
      localeNeedsWork,
      localePercent,
    }
  }, [keys, locales])

  // Overall %: approved translation records / (keys × non-base locales)
  const overallPercent = useMemo(() => {
    const nonBaseCount = locales.filter((l) => !l.is_base).length
    const total = keys.length * nonBaseCount
    if (total === 0) return 0
    return Math.round((stats.approvedRecords / total) * 100)
  }, [keys, locales, stats.approvedRecords])

  // Realtime
  const keyIds = useMemo(() => keys.map((k) => k.id), [keys])

  const handleRealtimeUpdate = useCallback(
    (update: {
      id: string
      branch_id: string | null
      key_id: string | null
      locale_id: string | null
      value: string | null
      status: string | null
      updated_at: string | null
    }) => {
      setKeys((prev) =>
        prev.map((k) => {
          if (k.id !== update.key_id) return k
          const idMatch = k.translations.some((t) => t.id === update.id)
          if (idMatch) {
            // Update existing row by ID
            return {
              ...k,
              translations: k.translations.map((t) =>
                t.id === update.id
                  ? { ...t, value: update.value, status: update.status, updated_at: update.updated_at }
                  : t
              ),
            }
          }
          // New insert or optimistic placeholder — match by locale_id
          const localeMatch = k.translations.some((t) => t.locale_id === update.locale_id)
          if (localeMatch) {
            return {
              ...k,
              translations: k.translations.map((t) =>
                t.locale_id === update.locale_id
                  ? { ...t, id: update.id, value: update.value, status: update.status, updated_at: update.updated_at }
                  : t
              ),
            }
          }
          // Completely new row (from another user's edit) — append
          return {
            ...k,
            translations: [
              ...k.translations,
              {
                id: update.id, branch_id: update.branch_id ?? activeBranchId,
                key_id: update.key_id, locale_id: update.locale_id,
                value: update.value, status: update.status, updated_at: update.updated_at,
                translated_by: null, reviewed_by: null,
                ai_model: null, ai_suggested_at: null, ai_suggestion: null,
              },
            ],
          }
        })
      )
    },
    [activeBranchId]
  )

  useRealtime({ keyIds, branchId: activeBranchId, onUpdate: handleRealtimeUpdate })
  const { presences, trackCell, clearCell } = usePresence(`${project.id}:${activeBranchId}`, user)

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowAddKey(true)
      }
      if (e.key === 'Escape') {
        if (editingCell) {
          setEditingCell(null)
          setEditValue('')
        } else if (selRange) {
          setSelRange(null)
        } else {
          setSelectedKeyId(null)
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [editingCell, selRange])

  // Virtualizer — measureElement enables dynamic row heights so tall cells don't clip
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => virtualRows[i]?.type === 'group' ? 32 : 84,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 8,
  })

  // Cell editing
  const startEdit = useCallback(
    (keyId: string, localeId: string, currentValue: string) => {
      setEditingCell(`${keyId}:${localeId}`)
      setEditValue(currentValue)
      // trackCell fires via textarea onFocus — no need to call here
    },
    []
  )

  const saveCell = useCallback(
    async (keyId: string, localeId: string) => {
      const cellId = `${keyId}:${localeId}`
      setSavingCell(cellId)
      setEditingCell(null)

      const value = editValue
      const isBase = locales.find((l) => l.id === localeId)?.is_base ?? false
      const status = value.trim() ? 'pending' : 'empty'

      // Record for undo (before applying the optimistic update)
      const prevCell = keys.find((k) => k.id === keyId)?.translations.find((t) => t.locale_id === localeId)
      pushUndo([{
        keyId, localeId,
        before: { value: prevCell?.value ?? '', status: prevCell?.status ?? 'empty' },
        after: { value, status },
      }])

      // Optimistic update — handles both existing rows and missing rows (upsert case)
      setKeys((prev) =>
        prev.map((k) => {
          if (k.id !== keyId) return k
          const hasRow = k.translations.some((t) => t.locale_id === localeId)
          let updatedTranslations = k.translations.map((t) => {
            if (t.locale_id === localeId) return { ...t, value, status }
            if (isBase && t.value && t.value.trim()) return { ...t, status: 'pending' as const }
            return t
          })
          if (!hasRow) {
            // No row yet — add optimistic placeholder (ID replaced when realtime fires)
            updatedTranslations = [
              ...updatedTranslations,
              {
                id: `optimistic-${localeId}`,
                branch_id: activeBranchId,
                key_id: keyId, locale_id: localeId, value, status,
                updated_at: new Date().toISOString(),
                translated_by: null, reviewed_by: null,
                ai_model: null, ai_suggested_at: null, ai_suggestion: null,
              },
            ]
          }
          return { ...k, translations: updatedTranslations }
        })
      )

      try {
        const resp = await fetch('/api/translations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branchId: activeBranchId, keyId, localeId, value, status }),
        })
        if (!resp.ok) {
          toast.error('Failed to save translation')
          return
        }
        // Replace optimistic ID with real DB ID
        const result = await resp.json() as { id?: string }
        if (result.id) {
          setKeys((prev) =>
            prev.map((k) => {
              if (k.id !== keyId) return k
              return {
                ...k,
                translations: k.translations.map((t) =>
                  t.locale_id === localeId && t.id === `optimistic-${localeId}`
                    ? { ...t, id: result.id! }
                    : t
                ),
              }
            })
          )
        }

        // If base lang changed, also reset targets in DB
        if (isBase) {
          const key = keys.find((k) => k.id === keyId)
          const targetItems = (key?.translations ?? [])
            .filter((t) => t.locale_id !== localeId && t.value && t.value.trim())
            .map((t) => ({ keyId, localeId: t.locale_id!, value: t.value! }))
          if (targetItems.length > 0) {
            await fetch('/api/translations/invalidate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ branchId: activeBranchId, items: targetItems }),
            })
          }
        }
      } catch {
        toast.error('Network error')
      } finally {
        setSavingCell(null)
        // trackCell(null) fires via textarea onBlur — no need to call here
      }
    },
    [editValue, locales, keys, pushUndo, activeBranchId]
  )

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
    // trackCell(null) fires via textarea onBlur — no need to call here
  }, [])

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
    const res = await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const json = await res.json() as { error?: string }
      toast.error(json.error ?? 'Delete failed')
      return
    }
    setKeys((prev) => prev.filter((k) => !selectedRows.has(k.id)))
    setSelectedRows(new Set())
    toast.success(`Deleted ${ids.length} key${ids.length > 1 ? 's' : ''}`)
  }, [selectedRows])

  const handleBulkApprove = useCallback(async () => {
    if (!canReview) return
    const ids = Array.from(selectedRows)
    const items = ids.flatMap((keyId) => {
      const key = keys.find((k) => k.id === keyId)
      return locales
        .map((locale) => {
          const t = key?.translations.find((tr) => tr.locale_id === locale.id)
          if (!t?.value) return null
          return { keyId, localeId: locale.id, value: t.value }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    })
    if (items.length === 0) return
    const res = await fetch('/api/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: activeBranchId, status: 'approved', items }),
    })
    if (!res.ok) {
      const json = await res.json() as { error?: string }
      toast.error(json.error ?? 'Approve failed')
      return
    }
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
  }, [canReview, selectedRows, locales, keys, activeBranchId])

  const handleBulkReview = useCallback(async () => {
    if (!canReview) return
    const ids = Array.from(selectedRows)
    const items = ids.flatMap((keyId) => {
      const key = keys.find((k) => k.id === keyId)
      return locales
        .map((locale) => {
          const t = key?.translations.find((tr) => tr.locale_id === locale.id)
          if (!t?.value || t.status === 'reviewed' || t.status === 'approved') return null
          return { keyId, localeId: locale.id, value: t.value }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    })
    if (items.length === 0) { toast.info('No eligible translations to review'); return }
    const res = await fetch('/api/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: activeBranchId, status: 'reviewed', items }),
    })
    if (!res.ok) {
      const json = await res.json() as { error?: string }
      toast.error(json.error ?? 'Review failed')
      return
    }
    setKeys((prev) =>
      prev.map((k) => {
        if (!selectedRows.has(k.id)) return k
        return {
          ...k,
          translations: k.translations.map((t) =>
            t.value && t.status !== 'reviewed' && t.status !== 'approved'
              ? { ...t, status: 'reviewed' }
              : t
          ),
        }
      })
    )
    setSelectedRows(new Set())
    toast.success(`Marked ${ids.length} key${ids.length > 1 ? 's' : ''} as reviewed`)
  }, [canReview, selectedRows, locales, keys, activeBranchId])

  // Column layout
  const COLS = { check: 40, key: 224, locale: 200, status: 88 }

  const showKey = !hiddenCols.has('key')
  const showStatus = !hiddenCols.has('status')

  // Apply custom order, frozen locales first (for correct sticky offset); both filtered by visibility
  const visibleLocales = useMemo(() => {
    const effectiveOrder = localeOrder.length ? localeOrder : locales.map((l) => l.id)
    const sorted = [...locales]
      .sort((a, b) => {
        const ai = effectiveOrder.indexOf(a.id)
        const bi = effectiveOrder.indexOf(b.id)
        return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi)
      })
      .filter((l) => !hiddenCols.has(l.id))
    const frozen = sorted.filter((l) => frozenCols.has(l.id))
    const rest = sorted.filter((l) => !frozenCols.has(l.id))
    return [...frozen, ...rest]
  }, [locales, localeOrder, frozenCols, hiddenCols])

  // Sticky left offset for each frozen column
  const stickyLeft = useMemo(() => {
    const map = new Map<string, number>()
    let offset = 0
    map.set('check', offset); offset += COLS.check
    if (showKey && frozenCols.has('key')) { map.set('key', offset); offset += COLS.key }
    for (const l of visibleLocales) {
      if (!frozenCols.has(l.id)) break
      map.set(l.id, offset); offset += COLS.locale
    }
    return map
  }, [showKey, frozenCols, visibleLocales, COLS.check, COLS.key, COLS.locale])

  const gridCols = [
    `${COLS.check}px`,
    showKey ? `${COLS.key}px` : null,
    ...visibleLocales.map(() => `${COLS.locale}px`),
    showStatus ? `${COLS.status}px` : null,
  ].filter(Boolean).join(' ')

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

  // ── Excel-like copy / paste ──────────────────────────────────────────────
  // Normalized selection bounds (inclusive) for highlight + copy/paste
  const selBounds = selRange
    ? {
        r0: Math.min(selRange.anchor.row, selRange.focus.row),
        r1: Math.max(selRange.anchor.row, selRange.focus.row),
        c0: Math.min(selRange.anchor.col, selRange.focus.col),
        c1: Math.max(selRange.anchor.col, selRange.focus.col),
      }
    : null

  // Mirror latest render state into a ref so the once-bound listeners read fresh data
  const latestRef = useRef<{
    selRange: typeof selRange
    editingCell: string | null
    keys: KeyWithTranslations[]
    visibleLocales: typeof visibleLocales
    rowOrder: string[]
    lockedCols: Set<string>
  }>({ selRange: null, editingCell: null, keys: [], visibleLocales: [], rowOrder: [], lockedCols: new Set() })
  latestRef.current = { selRange, editingCell, keys, visibleLocales, rowOrder, lockedCols }

  // Keep a fresh reference to startEdit for the once-bound keydown listener
  const startEditRef = useRef(startEdit)
  startEditRef.current = startEdit

  const applyPaste = useCallback((grid: string[][]) => {
    if (!canEdit) return
    const { selRange: sel, rowOrder: order, visibleLocales: vis, lockedCols: locked, keys: cur } = latestRef.current
    if (!sel || grid.length === 0) return
    const aRow = Math.min(sel.anchor.row, sel.focus.row)
    const aCol = Math.min(sel.anchor.col, sel.focus.col)
    const keyById = new Map(cur.map((k) => [k.id, k]))

    const items: { keyId: string; localeId: string; value: string; status: 'pending' | 'empty' }[] = []
    const changes: CellChange[] = []
    let lockedSkipped = 0
    for (let i = 0; i < grid.length; i++) {
      const gridRow = grid[i]
      if (!gridRow) continue
      const keyId = order[aRow + i]
      if (!keyId) break // past the last row
      for (let j = 0; j < gridRow.length; j++) {
        const locale = vis[aCol + j]
        if (!locale) continue // past the last column
        if (locked.has(locale.id)) { lockedSkipped++; continue }
        const value = gridRow[j] ?? ''
        const status = value.trim() ? 'pending' : 'empty' as const
        const prev = keyById.get(keyId)?.translations.find((t) => t.locale_id === locale.id)
        items.push({ keyId, localeId: locale.id, value, status })
        changes.push({
          keyId, localeId: locale.id,
          before: { value: prev?.value ?? '', status: prev?.status ?? 'empty' },
          after: { value, status },
        })
      }
    }
    if (items.length === 0) {
      if (lockedSkipped) toast.error('Target column is locked')
      return
    }
    pushUndo(changes)

    // Optimistic update
    const byKey = new Map<string, typeof items>()
    for (const it of items) {
      const arr = byKey.get(it.keyId) ?? []
      arr.push(it)
      byKey.set(it.keyId, arr)
    }
    setKeys((prev) =>
      prev.map((k) => {
        const its = byKey.get(k.id)
        if (!its) return k
        const trans = [...k.translations]
        for (const it of its) {
          const idx = trans.findIndex((t) => t.locale_id === it.localeId)
          const existing = idx >= 0 ? trans[idx] : undefined
          if (existing) {
            trans[idx] = { ...existing, value: it.value, status: it.status }
          } else {
            trans.push({
              id: `optimistic-${it.localeId}`,
              branch_id: activeBranchId,
              key_id: k.id, locale_id: it.localeId, value: it.value, status: it.status,
              updated_at: new Date().toISOString(),
              translated_by: null, reviewed_by: null,
              ai_model: null, ai_suggested_at: null, ai_suggestion: null,
            })
          }
        }
        return { ...k, translations: trans }
      })
    )

    // Persist
    void fetch('/api/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: activeBranchId, items }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { error?: string }
          toast.error(json.error ?? 'Paste failed')
        } else {
          toast.success(
            `Pasted ${items.length} cell${items.length > 1 ? 's' : ''}` +
            (lockedSkipped ? ` · ${lockedSkipped} locked skipped` : '')
          )
        }
      })
      .catch(() => toast.error('Network error'))
  }, [pushUndo, canEdit, activeBranchId])

  // Clear the contents of every non-empty, non-locked cell in the selection
  const clearSelection = useCallback(() => {
    if (!canEdit) return
    const { selRange: sel, rowOrder: order, visibleLocales: vis, lockedCols: locked, keys: cur } = latestRef.current
    if (!sel) return
    const r0 = Math.min(sel.anchor.row, sel.focus.row), r1 = Math.max(sel.anchor.row, sel.focus.row)
    const c0 = Math.min(sel.anchor.col, sel.focus.col), c1 = Math.max(sel.anchor.col, sel.focus.col)
    const keyById = new Map(cur.map((k) => [k.id, k]))

    const items: { keyId: string; localeId: string; value: string; status: 'empty' }[] = []
    const changes: CellChange[] = []
    let lockedSkipped = 0
    for (let r = r0; r <= r1; r++) {
      const keyId = order[r]
      if (!keyId) continue
      const key = keyById.get(keyId)
      for (let c = c0; c <= c1; c++) {
        const locale = vis[c]
        if (!locale) continue
        if (locked.has(locale.id)) { lockedSkipped++; continue }
        const t = key?.translations.find((tr) => tr.locale_id === locale.id)
        if (!t?.value) continue // already empty
        items.push({ keyId, localeId: locale.id, value: '', status: 'empty' })
        changes.push({
          keyId, localeId: locale.id,
          before: { value: t.value, status: t.status ?? 'empty' },
          after: { value: '', status: 'empty' },
        })
      }
    }
    if (items.length === 0) {
      if (lockedSkipped) toast.error('Selected column is locked')
      return
    }
    pushUndo(changes)

    const targetSet = new Set(items.map((it) => `${it.keyId}:${it.localeId}`))
    setKeys((prev) =>
      prev.map((k) => {
        const trans = k.translations.map((tr) =>
          targetSet.has(`${k.id}:${tr.locale_id}`) ? { ...tr, value: '', status: 'empty' } : tr
        )
        return { ...k, translations: trans }
      })
    )

    void fetch('/api/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: activeBranchId, items }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { error?: string }
          toast.error(json.error ?? 'Clear failed')
        } else {
          toast.success(`Cleared ${items.length} cell${items.length > 1 ? 's' : ''}`)
        }
      })
      .catch(() => toast.error('Network error'))
  }, [pushUndo, canEdit, activeBranchId])

  // Apply a set of cell states (optimistic + persist) — used by undo/redo
  const commitCells = useCallback((cells: { keyId: string; localeId: string; value: string; status: string }[]) => {
    if (cells.length === 0) return
    const byKey = new Map<string, typeof cells>()
    for (const c of cells) {
      const arr = byKey.get(c.keyId) ?? []
      arr.push(c)
      byKey.set(c.keyId, arr)
    }
    setKeys((prev) =>
      prev.map((k) => {
        const its = byKey.get(k.id)
        if (!its) return k
        const trans = [...k.translations]
        for (const it of its) {
          const idx = trans.findIndex((t) => t.locale_id === it.localeId)
          const existing = idx >= 0 ? trans[idx] : undefined
          if (existing) {
            trans[idx] = { ...existing, value: it.value, status: it.status }
          } else {
            trans.push({
              id: `optimistic-${it.localeId}`,
              branch_id: activeBranchId,
              key_id: k.id, locale_id: it.localeId, value: it.value, status: it.status,
              updated_at: new Date().toISOString(),
              translated_by: null, reviewed_by: null,
              ai_model: null, ai_suggested_at: null, ai_suggestion: null,
            })
          }
        }
        return { ...k, translations: trans }
      })
    )
    void fetch('/api/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: activeBranchId, items: cells }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { error?: string }
          toast.error(json.error ?? 'Update failed')
        }
      })
      .catch(() => toast.error('Network error'))
  }, [activeBranchId])

  const undo = useCallback(() => {
    const changes = undoRef.current.pop()
    if (!changes) return
    redoRef.current.push(changes)
    setHistTick((t) => t + 1)
    commitCells(changes.map((c) => ({ keyId: c.keyId, localeId: c.localeId, value: c.before.value, status: c.before.status })))
    toast.success('Undo')
  }, [commitCells])

  const redo = useCallback(() => {
    const changes = redoRef.current.pop()
    if (!changes) return
    undoRef.current.push(changes)
    setHistTick((t) => t + 1)
    commitCells(changes.map((c) => ({ keyId: c.keyId, localeId: c.localeId, value: c.after.value, status: c.after.status })))
    toast.success('Redo')
  }, [commitCells])

  useEffect(() => {
    const isEditableTarget = (el: Element | null) => {
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable
    }

    const onCopy = (e: ClipboardEvent) => {
      const { selRange: sel, editingCell: editing, rowOrder: order, visibleLocales: vis, keys: cur } = latestRef.current
      if (!sel || editing || isEditableTarget(document.activeElement)) return
      const r0 = Math.min(sel.anchor.row, sel.focus.row), r1 = Math.max(sel.anchor.row, sel.focus.row)
      const c0 = Math.min(sel.anchor.col, sel.focus.col), c1 = Math.max(sel.anchor.col, sel.focus.col)
      const keyById = new Map(cur.map((k) => [k.id, k]))
      const grid: string[][] = []
      for (let r = r0; r <= r1; r++) {
        const keyId = order[r]
        const key = keyId ? keyById.get(keyId) : undefined
        const line: string[] = []
        for (let c = c0; c <= c1; c++) {
          const localeId = vis[c]?.id
          const t = key?.translations.find((tr) => tr.locale_id === localeId)
          line.push(t?.value ?? '')
        }
        grid.push(line)
      }
      e.preventDefault()
      e.clipboardData?.setData('text/plain', serializeClipboardTable(grid))
    }

    const onPaste = (e: ClipboardEvent) => {
      const { selRange: sel, editingCell: editing } = latestRef.current
      if (!sel || editing || isEditableTarget(document.activeElement)) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (!text) return
      e.preventDefault()
      applyPaste(parseClipboardTable(text))
    }

    const onMouseUp = () => { pointerDownRef.current = false }

    // Clicking anywhere outside a translation cell clears the cell selection
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-cell]')) return
      if (latestRef.current.selRange) setSelRange(null)
    }

    // Enter / F2 → edit the selected cell; typing a char → overwrite (Excel-style)
    const onKeyDown = (e: KeyboardEvent) => {
      const { selRange: sel, editingCell: editing, rowOrder: order, visibleLocales: vis, keys: cur, lockedCols: locked } = latestRef.current
      const inField = isEditableTarget(document.activeElement)

      // Undo / redo — work regardless of selection, but not while typing in a field
      if (!inField && !editing && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (!inField && !editing && (e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        redo()
        return
      }

      if (editing || !sel || inField) return

      if (!canEdit) return

      // Delete / Backspace → clear all selected cells
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        clearSelection()
        return
      }

      const keyId = order[sel.focus.row]
      const locale = vis[sel.focus.col]
      if (!keyId || !locale || locked.has(locale.id)) return

      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault()
        const key = cur.find((k) => k.id === keyId)
        const t = key?.translations.find((tr) => tr.locale_id === locale.id)
        startEditRef.current(keyId, locale.id, t?.value ?? '')
        return
      }
      // Printable char (not space) with no modifiers → start editing, replacing content
      if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        startEditRef.current(keyId, locale.id, e.key)
      }
    }

    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [applyPaste, clearSelection, undo, redo, canEdit])

  // Column drag-to-reorder
  const handleColDragStart = useCallback((e: React.DragEvent, localeId: string) => {
    draggingLocaleRef.current = localeId
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleColDragOver = useCallback((e: React.DragEvent, localeId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverLocaleId(localeId)
  }, [])

  const handleColDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = draggingLocaleRef.current
    draggingLocaleRef.current = null
    setDragOverLocaleId(null)
    if (!sourceId || sourceId === targetId) return
    setLocaleOrder((prev) => {
      const base = prev.length ? prev : locales.map((l) => l.id)
      const from = base.indexOf(sourceId)
      const to = base.indexOf(targetId)
      if (from === -1 || to === -1) return prev
      const next = [...base]
      next.splice(from, 1)
      next.splice(to, 0, sourceId)
      return next
    })
  }, [locales])

  const handleColDragEnd = useCallback(() => {
    draggingLocaleRef.current = null
    setDragOverLocaleId(null)
  }, [])

  const selectedKey = keys.find((k) => k.id === selectedKeyId)

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-zinc-100 overflow-hidden">
      {/* ── TopNav ── */}
      <header className="h-12 border-b border-zinc-800 flex items-center px-4 gap-3 flex-shrink-0 bg-[#0d1117]">
        {/* Logo + breadcrumb */}
        <Link href="/projects" className="flex items-center gap-2 shrink-0 group">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Globe2 className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-zinc-100 group-hover:text-white transition-colors hidden lg:block">
            LangHub
          </span>
        </Link>
        <span className="text-zinc-700 text-sm select-none px-0.5">/</span>
        <span className="text-sm text-zinc-400 truncate max-w-[160px]" title={project.name}>
          {project.name}
        </span>
        <span className="text-zinc-700 text-sm select-none px-0.5">/</span>
        <span className="text-sm text-zinc-200 font-medium">Editor</span>

        <div className="ml-2">
          <BranchSwitcher
            projectId={project.id}
            branches={branches}
            activeBranchId={activeBranchId}
            canManage={canManage}
            switching={switchingBranch}
            onSwitch={handleSwitchBranch}
            onBranchCreated={handleBranchCreated}
            onBranchDeleted={handleBranchDeleted}
            onMerge={(sourceBranchId) => setMergeSourceId(sourceBranchId)}
          />
        </div>

        <div className="flex-1" />

        {/* Progress */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 mr-1">
          <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          <span>{overallPercent}%</span>
        </div>

        <div className="w-px h-4 bg-zinc-800" />

        {/* Data operations */}
        <div className="flex items-center">
          {canManage && (
            <Link href={`/${project.id}/import?branch=${activeBranchId}`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Import</span>
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100" onClick={() => setShowExport(true)}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Export</span>
          </Button>
        </div>

        <div className="w-px h-4 bg-zinc-800" />

        {/* Languages config */}
        {canManage && <ManageLocalesDialog project={project} onLocalesChanged={() => {}} />}

        {/* Overflow menu: Duplicates, Versions, AI Translate */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-100" title="More options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1 bg-zinc-900 border-zinc-800" align="end">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 px-2 py-1.5">Navigate</p>
            <Link href={`/${project.id}/keys`}>
              <button className="w-full text-left text-xs text-zinc-300 hover:text-zinc-100 px-2 py-1.5 rounded hover:bg-zinc-800/60 flex items-center gap-2">
                <Copy className="h-3.5 w-3.5 text-zinc-500" />
                Duplicates
              </button>
            </Link>
            <Link href={`/${project.id}/branches`}>
              <button className="w-full text-left text-xs text-zinc-300 hover:text-zinc-100 px-2 py-1.5 rounded hover:bg-zinc-800/60 flex items-center gap-2">
                <GitBranchIcon className="h-3.5 w-3.5 text-zinc-500" />
                Branches
              </button>
            </Link>
            <Link href={`/${project.id}/versions`}>
              <button className="w-full text-left text-xs text-zinc-300 hover:text-zinc-100 px-2 py-1.5 rounded hover:bg-zinc-800/60 flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-zinc-500" />
                Versions
              </button>
            </Link>
            <div className="border-t border-zinc-800 my-1" />
            <button
              className="w-full text-left text-xs text-zinc-600 cursor-not-allowed px-2 py-1.5 rounded flex items-center gap-2"
              onClick={() => toast.info('AI Translation — Coming Soon')}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Translate
              <span className="ml-auto text-[10px] bg-zinc-800 text-zinc-500 rounded px-1">Soon</span>
            </button>
          </PopoverContent>
        </Popover>

        <div className="w-px h-4 bg-zinc-800" />

        {/* User avatar */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 hover:ring-2 hover:ring-blue-500/50 transition-all"
              style={{ backgroundColor: stringToColor(user.email ?? user.id) }}
              title={user.email}
            >
              {(user.email?.[0] ?? '?').toUpperCase()}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-zinc-900 border-zinc-800" align="end">
            {/* Email */}
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ backgroundColor: stringToColor(user.email ?? user.id) }}
              >
                {(user.email?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-100 truncate font-medium">{user.email ?? 'Unknown'}</p>
                <span className={cn(
                  'inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5',
                  user.role === 'owner'      ? 'bg-purple-950 text-purple-300' :
                  user.role === 'admin'      ? 'bg-blue-950 text-blue-300' :
                  user.role === 'translator' ? 'bg-amber-950 text-amber-300' :
                                               'bg-zinc-800 text-zinc-400'
                )}>
                  {user.role}
                </span>
              </div>
            </div>
            <div className="border-t border-zinc-800 -mx-3 mb-2" />
            <Link href="/projects" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-100 px-1 py-1 rounded hover:bg-zinc-800/60 transition-colors">
              <LogOut className="h-3.5 w-3.5" />
              Back to projects
            </Link>
            <button
              onClick={() => void signOut()}
              className="w-full text-left flex items-center gap-2 text-xs text-red-400 hover:text-red-300 px-1 py-1 rounded hover:bg-zinc-800/60 transition-colors mt-0.5"
            >
              <LogOut className="h-3.5 w-3.5 rotate-180" />
              Sign out
            </button>
          </PopoverContent>
        </Popover>
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

        <div className="flex-1" />

        {/* Undo / Redo */}
        <div className="flex items-center">
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => undo()}
            disabled={undoRef.current.length === 0}
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => redo()}
            disabled={redoRef.current.length === 0}
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="w-px h-4 bg-zinc-800" />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                'h-7 text-xs gap-1.5',
                (hiddenCols.size > 0 || lockedCols.size > 0 || frozenCols.size > 1 || localeOrder.length > 0)
                  ? 'text-blue-400 bg-blue-950/40 hover:bg-blue-950/60'
                  : 'text-zinc-400 hover:text-zinc-100'
              )}
              title="Configure columns"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1 bg-zinc-900 border-zinc-800" align="end">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 px-2 py-1.5">Columns</p>
            {/* Key column */}
            {(() => {
              const hidden = hiddenCols.has('key')
              const frozen = frozenCols.has('key')
              return (
                <div className="flex items-center gap-0.5 px-2 py-1 rounded hover:bg-zinc-800/60">
                  <span className="flex-1 text-xs text-zinc-300">Key name</span>
                  <button
                    onClick={() => setFrozenCols((p) => { const n = new Set(p); if (frozen) n.delete('key'); else n.add('key'); return n })}
                    className={cn('p-1 rounded', frozen ? 'text-blue-400 hover:text-blue-300' : 'text-zinc-600 hover:text-zinc-300')}
                    title={frozen ? 'Unfreeze column' : 'Freeze column (stays visible when scrolling)'}
                  >
                    {frozen ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => setHiddenCols((p) => { const n = new Set(p); if (hidden) n.delete('key'); else n.add('key'); return n })}
                    className={cn('p-1 rounded', hidden ? 'text-zinc-600 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-200')}
                    title={hidden ? 'Show' : 'Hide'}
                  >
                    {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              )
            })()}
            {/* Status column */}
            {(() => {
              const hidden = hiddenCols.has('status')
              return (
                <div className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800/60">
                  <span className="flex-1 text-xs text-zinc-300">Status</span>
                  <button
                    onClick={() => setHiddenCols((p) => { const n = new Set(p); if (hidden) n.delete('status'); else n.add('status'); return n })}
                    className={cn('p-1 rounded', hidden ? 'text-zinc-600 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-200')}
                    title={hidden ? 'Show' : 'Hide'}
                  >
                    {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              )
            })()}
            <div className="border-t border-zinc-800 my-1" />
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 px-2 py-1">Languages</p>
            {locales.map((locale) => {
              const hidden = hiddenCols.has(locale.id)
              const frozen = frozenCols.has(locale.id)
              const locked = lockedCols.has(locale.id)
              return (
                <div key={locale.id} className="flex items-center gap-0.5 px-2 py-1 rounded hover:bg-zinc-800/60">
                  <span className="text-sm">{getFlag(locale.code)}</span>
                  <span className="flex-1 text-xs text-zinc-300 truncate ml-1">{locale.name}</span>
                  <button
                    onClick={() => setFrozenCols((p) => { const n = new Set(p); if (frozen) n.delete(locale.id); else n.add(locale.id); return n })}
                    className={cn('p-1 rounded', frozen ? 'text-blue-400 hover:text-blue-300' : 'text-zinc-600 hover:text-zinc-300')}
                    title={frozen ? 'Unfreeze column' : 'Freeze column (stays visible when scrolling)'}
                  >
                    {frozen ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => setLockedCols((p) => { const n = new Set(p); if (locked) n.delete(locale.id); else n.add(locale.id); return n })}
                    className={cn('p-1 rounded', locked ? 'text-orange-400 hover:text-orange-300' : 'text-zinc-600 hover:text-zinc-300')}
                    title={locked ? 'Unlock (allow editing)' : 'Lock (read-only)'}
                  >
                    {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => setHiddenCols((p) => { const n = new Set(p); if (hidden) n.delete(locale.id); else n.add(locale.id); return n })}
                    className={cn('p-1 rounded', hidden ? 'text-zinc-600 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-200')}
                    title={hidden ? 'Show' : 'Hide'}
                  >
                    {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              )
            })}
            {(hiddenCols.size > 0 || lockedCols.size > 0 || frozenCols.size > 1 || localeOrder.length > 0) && (
              <>
                <div className="border-t border-zinc-800 my-1" />
                <button
                  onClick={() => { setHiddenCols(new Set()); setFrozenCols(new Set(['key'])); setLockedCols(new Set()); setLocaleOrder([]) }}
                  className="w-full text-left text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5 rounded hover:bg-zinc-800/60"
                >
                  Reset all
                </button>
              </>
            )}
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            'h-7 text-xs gap-1.5',
            groupBy ? 'text-blue-400 bg-blue-950/40 hover:bg-blue-950/60' : 'text-zinc-400 hover:text-zinc-100'
          )}
          onClick={() => setGroupBy((v) => !v)}
          title="Group by namespace"
        >
          <Layers2 className="h-3.5 w-3.5" />
          Group
        </Button>

        <div className="w-px h-4 bg-zinc-800" />

        {canManage && (
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setShowAddKey(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Key
          </Button>
        )}
      </div>

      {/* ── Presence bar ── */}
      {/* Always render — height reserved so grid never shifts. Fade content in/out. */}
      {(() => {
        const active = presences.filter((p) => p.keyId)
        const visible = active.length > 0
        return (
          <div className="h-7 border-b border-zinc-800/50 flex-shrink-0 overflow-hidden relative">
            <div
              className={cn(
                'absolute inset-0 bg-blue-950/30 flex items-center px-4 gap-2 transition-opacity duration-300',
                visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            >
              <div className="flex -space-x-1">
                {active.slice(0, 4).map((p) => (
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
                {active.length === 1
                  ? `${active[0]!.email} is editing`
                  : `${active.length} people editing`}
              </span>
            </div>
          </div>
        )
      })()}

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-52 border-r border-zinc-800 flex flex-col flex-shrink-0 overflow-y-auto bg-zinc-950">
          {/* Status filters */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">Status</span>
              {filteredKeys.length !== stats.total && (
                <span className="text-[10px] text-zinc-600">
                  {filteredKeys.length}<span className="text-zinc-700"> / {stats.total}</span>
                </span>
              )}
            </div>
            {([
              { id: 'all', label: 'All Keys', count: stats.total },
              { id: 'empty', label: 'Untranslated', count: stats.empty },
              { id: 'pending', label: 'Pending', count: stats.pending },
              { id: 'reviewed', label: 'Reviewed', count: stats.reviewed },
              { id: 'approved', label: 'Approved', count: stats.approved },
            ] as { id: FilterStatus; label: string; count: number }[]).map((item) => {
              const isActive = filterStatus === item.id && !selectedLocaleId
              const dotColor =
                item.id === 'approved' ? 'bg-emerald-500' :
                item.id === 'reviewed' ? 'bg-blue-500' :
                item.id === 'pending' ? 'bg-amber-500' :
                item.id === 'empty' ? 'bg-zinc-600' : null
              return (
                <button
                  key={item.id}
                  onClick={() => { setFilterStatus(item.id); setSelectedLocaleId(null) }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                    isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                  )}
                >
                  {dotColor
                    ? <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} />
                    : <span className="w-1.5 h-1.5 flex-shrink-0" />
                  }
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.count > 0 && (
                    <span className={cn(
                      'text-[10px] tabular-nums',
                      item.id === 'empty' ? 'text-amber-400' :
                      item.id === 'approved' ? 'text-emerald-500/70' : 'text-zinc-600'
                    )}>
                      {item.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Language focus */}
          <div className="border-t border-zinc-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2 px-1">Languages</div>
            {locales.filter((l) => !l.is_base).map((locale) => {
              const isActive = selectedLocaleId === locale.id
              const needsWork = stats.localeNeedsWork.get(locale.id) ?? 0
              return (
                <button
                  key={locale.id}
                  onClick={() => {
                    setSelectedLocaleId(isActive ? null : locale.id)
                    setFilterStatus('all')
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                    isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                  )}
                >
                  <span className="text-sm leading-none">{getFlag(locale.code)}</span>
                  <span className="flex-1 text-left truncate">{locale.name}</span>
                  {needsWork > 0 ? (
                    <span className="text-[10px] text-amber-400 tabular-nums">{needsWork}</span>
                  ) : (
                    <span className="text-[10px] text-emerald-500/70">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Table */}
        <div className="flex flex-1 overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-auto">
            {/* Sticky header */}
            <div
              className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 grid min-w-max"
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Checkbox — viewer excluded */}
              <div
                className="flex items-center justify-center h-9 sticky z-20 bg-zinc-900"
                style={{ left: stickyLeft.get('check') }}
              >
                {canSelect && (
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredKeys.length && filteredKeys.length > 0}
                    onChange={toggleAllRows}
                    className="accent-blue-500 cursor-pointer"
                  />
                )}
              </div>
              {/* Key */}
              {showKey && (
                <div
                  className={cn(
                    'px-3 flex items-center h-9 gap-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wide',
                    stickyLeft.has('key') && 'sticky z-20 bg-zinc-900'
                  )}
                  style={stickyLeft.has('key') ? { left: stickyLeft.get('key') } : undefined}
                >
                  {frozenCols.has('key') && <Pin className="h-2.5 w-2.5 text-blue-500 flex-shrink-0" />}
                  Key
                </div>
              )}
              {/* Locale columns */}
              {visibleLocales.map((locale) => {
                const colStatus = columnFilters.get(locale.id) ?? 'all'
                const isFiltered = colStatus !== 'all'
                const COL_STATUS_OPTIONS: { id: FilterStatus; label: string }[] = [
                  { id: 'all', label: 'All' },
                  { id: 'empty', label: 'Empty' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'reviewed', label: 'Reviewed' },
                  { id: 'approved', label: 'Approved' },
                ]
                const isFrozen = frozenCols.has(locale.id)
                const isLocked = lockedCols.has(locale.id)
                const isDraggingThis = dragOverLocaleId === locale.id && draggingLocaleRef.current !== locale.id
                return (
                  <div
                    key={locale.id}
                    draggable
                    onDragStart={(e) => handleColDragStart(e, locale.id)}
                    onDragOver={(e) => handleColDragOver(e, locale.id)}
                    onDrop={(e) => handleColDrop(e, locale.id)}
                    onDragEnd={handleColDragEnd}
                    className={cn(
                      'px-2 flex items-center h-9 gap-1 text-xs font-medium text-zinc-400 select-none',
                      isFrozen && 'sticky z-20 bg-zinc-900',
                      isDraggingThis && 'border-l-2 border-blue-500 bg-blue-950/20'
                    )}
                    style={isFrozen ? { left: stickyLeft.get(locale.id) } : undefined}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-zinc-700 hover:text-zinc-400 cursor-grab flex-shrink-0" />
                    <span>{getFlag(locale.code)}</span>
                    <span className="uppercase">{locale.code}</span>
                    {locale.is_base && (
                      <span className="text-[9px] text-zinc-600 border border-zinc-700 rounded px-0.5">base</span>
                    )}
                    {isFrozen && <Pin className="h-2.5 w-2.5 text-blue-500 flex-shrink-0" />}
                    {isLocked && <Lock className="h-2.5 w-2.5 text-orange-400 flex-shrink-0" />}
                    {(() => {
                      const pct = stats.localePercent.get(locale.id) ?? 0
                      return (
                        <span className={cn(
                          'ml-auto text-[10px]',
                          pct >= 80 ? 'text-emerald-500' :
                          pct >= 50 ? 'text-amber-500' : 'text-red-500'
                        )}>
                          {pct}%
                        </span>
                      )
                    })()}
                    {!locale.is_base && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              'p-0.5 rounded transition-colors',
                              isFiltered
                                ? 'text-blue-400 hover:text-blue-300'
                                : 'text-zinc-600 hover:text-zinc-300'
                            )}
                            title="Filter by status"
                          >
                            <ListFilter className="h-3 w-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-36 p-1 bg-zinc-900 border-zinc-800" align="start">
                          {COL_STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setColumnFilters((prev) => {
                                  const next = new Map(prev)
                                  if (opt.id === 'all') next.delete(locale.id)
                                  else next.set(locale.id, opt.id)
                                  return next
                                })
                              }}
                              className={cn(
                                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                                colStatus === opt.id
                                  ? 'bg-zinc-800 text-zinc-100'
                                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                              )}
                            >
                              {opt.id !== 'all' && (
                                <span className={cn(
                                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                  opt.id === 'approved' && 'bg-emerald-500',
                                  opt.id === 'reviewed' && 'bg-blue-500',
                                  opt.id === 'pending' && 'bg-amber-500',
                                  opt.id === 'empty' && 'bg-zinc-600',
                                )} />
                              )}
                              {opt.label}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                )
              })}
              {/* Status */}
              {showStatus && (
                <div className="px-3 flex items-center h-9 text-xs font-medium text-zinc-400 uppercase tracking-wide">
                  Status
                </div>
              )}
            </div>

            {/* Empty state */}
            {filteredKeys.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                {keys.length === 0 ? (
                  <>
                    <Upload className="h-8 w-8 mb-3 opacity-20" />
                    <p className="text-sm font-medium text-zinc-400 mb-1">No keys yet</p>
                    <p className="text-xs text-zinc-600 mb-4">Import a file or add your first key manually</p>
                    <div className="flex gap-2">
                      <Link href={`/${project.id}/import?branch=${activeBranchId}`}>
                        <Button size="sm" variant="outline" className="border-zinc-700 gap-1.5">
                          <Upload className="h-3.5 w-3.5" />
                          Import File
                        </Button>
                      </Link>
                      {canManage && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => setShowAddKey(true)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Key
                          <span className="text-blue-200/60 text-[10px] ml-1">⌘K</span>
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm">No keys match your filters</p>
                )}
              </div>
            )}

            {/* Virtual rows — in-flow layout so position:sticky works for frozen columns.
                 Absolute rows break horizontal sticky; a single translateY wrapper fixes it. */}
            {virtualRows.length > 0 && (() => {
              const vItems = virtualizer.getVirtualItems()
              if (!vItems.length) return null
              return (
                <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                  <div style={{ transform: `translateY(${vItems[0]!.start}px)` }}>
                    {vItems.map((virtualRow) => {
                      const row = virtualRows[virtualRow.index]
                      if (!row) return null

                      // Group header row
                      if (row.type === 'group') {
                        const isCollapsed = collapsedGroups.has(row.fullPath)
                        return (
                          <div
                            key={virtualRow.key}
                            ref={virtualizer.measureElement}
                            data-index={virtualRow.index}
                            className="flex items-center gap-1.5 border-b border-zinc-800/50 bg-zinc-950 cursor-pointer select-none min-w-max"
                            style={{ paddingLeft: `${12 + row.depth * 16}px`, height: '32px' }}
                            onClick={() =>
                              setCollapsedGroups((prev) => {
                                const next = new Set(prev)
                                if (next.has(row.fullPath)) next.delete(row.fullPath)
                                else next.add(row.fullPath)
                                return next
                              })
                            }
                          >
                            <ChevronDown className={cn('h-3 w-3 text-zinc-500 transition-transform flex-shrink-0', isCollapsed && '-rotate-90')} />
                            <span className="font-mono text-xs font-medium text-zinc-300">{row.label}</span>
                            <span className="text-[10px] text-zinc-600">{row.count}</span>
                          </div>
                        )
                      }

                      const keyItem = row.item
                      const isSelected = selectedRows.has(keyItem.id)
                      const isActive = selectedKeyId === keyItem.id
                      const rowIndex = rowIndexByKeyId.get(keyItem.id) ?? -1
                      const keyParts = keyItem.key.split('.')
                      const displayKey = groupBy && row.depth > 0 ? (keyParts[keyParts.length - 1] ?? keyItem.key) : keyItem.key

                      return (
                        <div
                          key={virtualRow.key}
                          ref={virtualizer.measureElement}
                          data-index={virtualRow.index}
                          className={cn(
                            'group grid border-b border-zinc-800/50 min-w-max transition-colors cursor-default',
                            isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/40',
                            isSelected && 'bg-blue-950/40'
                          )}
                          style={{ gridTemplateColumns: gridCols, minHeight: '84px' }}
                        >
                          {/* Checkbox — always sticky */}
                          <div
                            className={cn(
                              'flex items-start justify-center pt-2.5 sticky z-10',
                              isActive ? 'bg-zinc-800' : 'bg-zinc-950 group-hover:bg-zinc-800',
                              isSelected && 'bg-blue-950'
                            )}
                            style={{ left: stickyLeft.get('check') }}
                            onClick={(e) => canSelect && toggleRow(keyItem.id, e)}
                          >
                            {canSelect && <input type="checkbox" checked={isSelected} onChange={() => undefined} className="accent-blue-500 cursor-pointer" />}
                          </div>

                          {/* Key name */}
                          {showKey && (
                            <div
                              className={cn(
                                'flex flex-col justify-start pt-2 cursor-pointer pr-3',
                                frozenCols.has('key') && cn(
                                  'sticky z-10',
                                  isActive ? 'bg-zinc-800' : 'bg-zinc-950 group-hover:bg-zinc-800',
                                  isSelected && 'bg-blue-950'
                                )
                              )}
                              style={{
                                paddingLeft: `${12 + row.depth * 16}px`,
                                ...(frozenCols.has('key') ? { left: stickyLeft.get('key') } : {}),
                              }}
                              onClick={() => setSelectedKeyId(isActive ? null : keyItem.id)}
                            >
                              <span className="font-mono text-xs text-zinc-200 truncate">{displayKey}</span>
                              {keyItem.description && (
                                <span className="text-[10px] text-zinc-600 truncate">{keyItem.description}</span>
                              )}
                            </div>
                          )}

                          {/* Translation cells */}
                          {visibleLocales.map((locale, colIndex) => {
                            const t = keyItem.translations.find((tr) => tr.locale_id === locale.id)
                            const cellId = `${keyItem.id}:${locale.id}`
                            const isEditingThis = editingCell === cellId
                            const isSavingThis = savingCell === cellId
                            const presenceColor = presenceCellMap.get(cellId)
                            const isFrozen = frozenCols.has(locale.id)
                            const isLocked = lockedCols.has(locale.id)
                            const inSel = !!selBounds && !isEditingThis &&
                              rowIndex >= selBounds.r0 && rowIndex <= selBounds.r1 &&
                              colIndex >= selBounds.c0 && colIndex <= selBounds.c1

                            return (
                              <Fragment key={locale.id}>
                                <div
                                  data-cell="1"
                                  className={cn('relative h-[84px] select-none', isFrozen && cn(
                                    'sticky z-10',
                                    isActive ? 'bg-zinc-800' : 'bg-zinc-950 group-hover:bg-zinc-800',
                                    isSelected && 'bg-blue-950'
                                  ))}
                                  style={isFrozen ? { left: stickyLeft.get(locale.id) } : undefined}
                                  onMouseDown={(e) => {
                                    if (e.button !== 0 || isEditingThis) return
                                    // Commit any edit in another cell — preventDefault below blocks the native blur
                                    const ae = document.activeElement as HTMLElement | null
                                    if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) ae.blur()
                                    if (e.shiftKey && selRangeRef.current) {
                                      e.preventDefault()
                                      didDragRef.current = true
                                      setSelRange({ anchor: selRangeRef.current.anchor, focus: { row: rowIndex, col: colIndex } })
                                      return
                                    }
                                    e.preventDefault()
                                    pointerDownRef.current = true
                                    didDragRef.current = false
                                    setSelRange({ anchor: { row: rowIndex, col: colIndex }, focus: { row: rowIndex, col: colIndex } })
                                  }}
                                  onMouseEnter={() => {
                                    if (!pointerDownRef.current) return
                                    didDragRef.current = true
                                    setSelRange((prev) => (prev ? { anchor: prev.anchor, focus: { row: rowIndex, col: colIndex } } : prev))
                                  }}
                                  onClick={() => { didDragRef.current = false }}
                                  onDoubleClick={() => {
                                    if (!canEdit || isLocked || isEditingThis) return
                                    setSelRange(null)
                                    startEdit(keyItem.id, locale.id, t?.value ?? '')
                                  }}
                                >
                                  <TranslationCell
                                    value={t?.value ?? null}
                                    status={t?.status ?? 'empty'}
                                    charLimit={keyItem.char_limit}
                                    isEditing={isEditingThis}
                                    isSaving={isSavingThis}
                                    editValue={editValue}
                                    presenceColor={presenceColor}
                                    isReadonly={isLocked}
                                    onEditValueChange={setEditValue}
                                    onFocused={() => trackCell(keyItem.id, locale.id)}
                                    onBlurred={clearCell}
                                    onSave={() => void saveCell(keyItem.id, locale.id)}
                                    onCancel={cancelEdit}
                                  />
                                  {inSel && (
                                    <div className="pointer-events-none absolute inset-0 z-20 bg-blue-500/15 ring-1 ring-inset ring-blue-400/70" />
                                  )}
                                </div>
                              </Fragment>
                            )
                          })}

                          {/* Status */}
                          {showStatus && (
                            <div className="px-3 flex items-start pt-2.5">
                              <StatusBadge status={keyOverallStatus(keyItem, locales)} size="xs" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      <KeyDetailPanel
        keyItem={selectedKey}
        locales={locales}
        userId={user.id}
        branchId={activeBranchId}
        canEdit={canEdit}
        canEditKeys={canEditKeys}
        onClose={() => setSelectedKeyId(null)}
        onKeyUpdated={(patch) => handleKeyUpdated(selectedKeyId!, patch)}
        onKeyDeleted={handleKeyDeleted}
      />

      {/* Merge dialog */}
      {mergeSourceId && (() => {
        const source = branches.find((b) => b.id === mergeSourceId)
        const target = branches.find((b) => b.id === activeBranchId)
        if (!source || !target) return null
        return (
          <MergeDialog
            projectId={project.id}
            sourceBranch={source}
            targetBranch={target}
            onClose={() => setMergeSourceId(null)}
            onMerged={({ deletedSourceId }) => {
              setMergeSourceId(null)
              if (deletedSourceId) setBranches((prev) => prev.filter((b) => b.id !== deletedSourceId))
              void reloadActiveBranch()
            }}
          />
        )
      })()}

      {/* Bulk action bar — translators+ see count/clear; review/approve/delete gated inside */}
      {canSelect && selectedRows.size > 0 && (
        <BulkActionBar
          selectedCount={selectedRows.size}
          projectId={project.id}
          canReview={canReview}
          canDelete={canEditKeys}
          onClear={() => setSelectedRows(new Set())}
          onDelete={handleBulkDelete}
          onReview={handleBulkReview}
          onApprove={handleBulkApprove}
        />
      )}

      {/* Add Key sheet */}
      <AddKeySheet
        open={showAddKey}
        projectId={project.id}
        branchId={activeBranchId}
        locales={locales}
        existingKeys={keys.map((k) => k.key)}
        onClose={() => setShowAddKey(false)}
        onCreated={handleKeyCreated}
      />

      {/* Export dialog */}
      <ExportSheet
        open={showExport}
        project={project}
        branchId={activeBranchId}
        onClose={() => setShowExport(false)}
      />
    </div>
  )
}
