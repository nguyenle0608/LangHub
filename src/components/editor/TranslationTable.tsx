'use client'

import { useState, useRef, useMemo, useCallback, Fragment, useEffect } from 'react'
import Link from 'next/link'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Search, Plus, Download, Upload,
  Sparkles, LogOut, ListFilter, Layers2, ChevronDown,
  Columns3, Eye, EyeOff, Pin, PinOff, Lock, Unlock, GripVertical, Undo2, Redo2,
  MoreHorizontal, Copy, History, GitBranch as GitBranchIcon, Loader2, ArrowUp,
  Info, X, Folder, FolderOpen, FileKey2,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import dynamic from 'next/dynamic'
import { TranslationCell } from './TranslationCell'
import { StatusBadge } from './StatusBadge'
import { Tooltip } from '@/components/ui/tooltip'
import { ThemeHeaderButton } from '@/components/theme/ThemeHeaderButton'
import { BranchSwitcher } from './BranchSwitcher'

// Interaction-only modals/sheets — lazy-loaded so they stay out of the
// editor's initial bundle and only fetch when the user opens them.
const MergeDialog = dynamic(() => import('./MergeDialog').then((m) => m.MergeDialog))
const AddKeySheet = dynamic(() => import('./AddKeySheet').then((m) => m.AddKeySheet))
const KeyDetailPanel = dynamic(() => import('./KeyDetailPanel').then((m) => m.KeyDetailPanel))
const ExportSheet = dynamic(() => import('@/components/export/ExportSheet').then((m) => m.ExportSheet))
const BulkActionBar = dynamic(() => import('./BulkActionBar').then((m) => m.BulkActionBar))
const CellActionBar = dynamic(() => import('./CellActionBar').then((m) => m.CellActionBar))
const ManageLocalesDialog = dynamic(() => import('./ManageLocalesDialog').then((m) => m.ManageLocalesDialog))
import { useRealtime } from '@/hooks/useRealtime'
import { usePresence } from '@/hooks/usePresence'
import type { ProjectWithStats, MemberRole } from '@/types'
import type { KeyWithTranslations } from '@/lib/supabase/queries/translations'
import type { Branch } from '@/lib/branches/queries'
import { localeFlag as getFlag } from '@/lib/locale-flag'
import { signOut } from '@/lib/supabase/auth'
import {
  KEY_TREE_ROOT_ID,
  buildTranslationKeyTree,
  resolveCheckedTranslationKeyIds,
  type TranslationKeyTreeNode,
} from '@/lib/translation-key-tree'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  project: ProjectWithStats
  initialKeys: KeyWithTranslations[]
  // Total keys on the active branch. initialKeys is the first window; the
  // rest stream in client-side. May exceed initialKeys.length.
  totalKeyCount: number
  branches: Branch[]
  activeBranchId: string
  user: { id: string; email?: string | undefined; role: MemberRole }
}

type FilterStatus = 'all' | 'empty' | 'pending' | 'reviewed' | 'approved'

type VirtualRow =
  | { type: 'group'; fullPath: string; label: string; depth: number; count: number }
  | { type: 'key'; item: KeyWithTranslations; depth: number }

function virtualRowKey(row: VirtualRow): string {
  return row.type === 'group' ? `group:${row.fullPath}` : `key:${row.item.id}`
}

function groupLevelClass(depth: number): string {
  return [
    'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    'border-violet-500/40 bg-violet-500/10 text-violet-300',
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  ][depth % 4] ?? 'border-border bg-muted text-foreground'
}

function groupBarClass(depth: number): string {
  return [
    'border-blue-500/30 bg-blue-50/90 text-blue-700 dark:bg-blue-950/80 dark:text-blue-200',
    'border-violet-500/30 bg-violet-50/90 text-violet-700 dark:bg-violet-950/80 dark:text-violet-200',
    'border-emerald-500/30 bg-emerald-50/90 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-200',
    'border-amber-500/30 bg-amber-50/90 text-amber-700 dark:bg-amber-950/80 dark:text-amber-200',
  ][depth % 4] ?? 'border-border bg-background/95 text-foreground'
}

function groupIconClass(depth: number): string {
  return [
    'text-blue-700 dark:text-blue-300',
    'text-violet-300',
    'text-emerald-300',
    'text-amber-700 dark:text-amber-300',
  ][depth % 4] ?? 'text-foreground'
}

type KeyTreeFilterProps = {
  checkedNodeIds: Set<string>
  expandedNodeIds: Set<string>
  onToggleChecked: (nodeId: string) => void
  onToggleExpanded: (nodeId: string) => void
  onLeafClick: (keyId: string) => void
  ambiguousKeyNames: Set<string>
}

function KeyTreeNodeRow({
  node,
  depth,
  checkedNodeIds,
  expandedNodeIds,
  onToggleChecked,
  onToggleExpanded,
  onLeafClick,
  ambiguousKeyNames,
}: KeyTreeFilterProps & { node: TranslationKeyTreeNode; depth: number }) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedNodeIds.has(node.id)
  const isChecked = checkedNodeIds.has(node.id)
  const isRoot = node.kind === 'root'
  const isFolderLike = node.kind === 'root' || node.kind === 'folder'
  const leafIsAlsoFolder = !!node.keyName && ambiguousKeyNames.has(node.keyName)
  const folderIconClass = isRoot ? 'text-muted-foreground' : groupIconClass(Math.max(0, depth - 1))

  return (
    <div>
      <div
        className={cn(
          'group flex min-w-0 items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors',
          node.kind === 'leaf' && 'cursor-pointer',
          isChecked ? 'bg-blue-100/70 dark:bg-blue-950/50 text-blue-700 dark:text-blue-100' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
        )}
        style={{ paddingLeft: `${6 + depth * 12}px` }}
        onClick={() => {
          if (node.kind === 'leaf' && node.keyId) onLeafClick(node.keyId)
        }}
      >
        <button
          type="button"
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground',
            !hasChildren && 'invisible'
          )}
          onClick={() => onToggleExpanded(node.id)}
          aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', !isExpanded && '-rotate-90')} />
        </button>
        {isRoot ? (
          <span className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        ) : (
          <input
            type="checkbox"
            checked={isChecked}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggleChecked(node.id)}
            className="h-3 w-3 flex-shrink-0 cursor-pointer accent-blue-500"
            aria-label={`Filter by ${node.label}`}
          />
        )}
        {isFolderLike ? (
          isExpanded ? (
            <FolderOpen className={cn('h-3.5 w-3.5 flex-shrink-0', folderIconClass)} />
          ) : (
            <Folder className={cn('h-3.5 w-3.5 flex-shrink-0', folderIconClass)} />
          )
        ) : (
          <FileKey2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-mono" title={node.kind === 'leaf' ? node.keyName : node.path || '{}'}>
          {node.label}
        </span>
        {leafIsAlsoFolder && (
          <span className="rounded border border-border px-1 text-[9px] text-muted-foreground" title="Exact key; separate from folder descendants">
            key
          </span>
        )}
        {isFolderLike && (
          <span className="text-[10px] tabular-nums text-muted-foreground">{node.descendantKeyIds.length}</span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <KeyTreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              checkedNodeIds={checkedNodeIds}
              expandedNodeIds={expandedNodeIds}
              onToggleChecked={onToggleChecked}
              onToggleExpanded={onToggleExpanded}
              onLeafClick={onLeafClick}
              ambiguousKeyNames={ambiguousKeyNames}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function keyOverallStatus(
  key: KeyWithTranslations,
  locales: ProjectWithStats['locales'],
): string {
  // Status normally reflects the target (non-base) locales. When the project
  // has only the base locale, fall back to scoring the base itself — otherwise
  // every key would read as "empty" even after the base is filled/approved.
  const targets = locales.filter((l) => !l.is_base)
  const scored = targets.length > 0 ? targets : locales
  if (scored.length === 0) return 'empty'
  const scoredIds = new Set(scored.map((l) => l.id))
  const scoredTranslations = key.translations.filter((t) => t.locale_id && scoredIds.has(t.locale_id))
  const filled = scoredTranslations.filter((t) => t.value && t.value.trim())
  if (filled.length === 0) return 'empty'
  if (filled.length < scored.length) return 'pending'
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

export function TranslationTable({ project, initialKeys, totalKeyCount, branches: initialBranches, activeBranchId: initialBranchId, user }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const SIDEBAR_MIN_WIDTH = 180
  const SIDEBAR_MAX_WIDTH = 420
  const DEFAULT_COLS = { check: 40, key: 224, locale: 200, status: 88 }
  const KEY_COL_MIN_WIDTH = 160
  const KEY_COL_MAX_WIDTH = 420
  const LOCALE_COL_MIN_WIDTH = 140
  const LOCALE_COL_MAX_WIDTH = 420

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
  const [checkedKeyTreeNodeIds, setCheckedKeyTreeNodeIds] = useState<Set<string>>(new Set())
  const [expandedKeyTreeNodeIds, setExpandedKeyTreeNodeIds] = useState<Set<string>>(() => new Set([KEY_TREE_ROOT_ID]))
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
  // Show a "scroll to top" button once the table is scrolled down a bit
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [tableScrolled, setTableScrolled] = useState(false)
  const [tableScrolledX, setTableScrolledX] = useState(false)
  const [tableScrollTop, setTableScrollTop] = useState(0)
  const [sidebarWidth, setSidebarWidth] = useState(208)
  const [resizingSidebar, setResizingSidebar] = useState(false)
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [keyColWidth, setKeyColWidth] = useState(DEFAULT_COLS.key)
  const [localeColWidths, setLocaleColWidths] = useState<Map<string, number>>(new Map())
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null)
  const columnResizeRef = useRef<{ columnId: string; startX: number; startWidth: number; min: number; max: number } | null>(null)

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

  // Windowed loading: the server ships the first page; the rest stream in
  // here. loadSeqRef guards against races when the user switches branch mid-
  // load — each load captures a seq and bails if a newer load superseded it.
  const LOAD_PAGE = 500
  const loadSeqRef = useRef(0)
  const initialStreamStartedRef = useRef(false)
  const [loadingMore, setLoadingMore] = useState(initialKeys.length < totalKeyCount)

  // Append remaining pages for a branch using keyset pagination — each page is
  // fetched with `after` = the last key already loaded.
  const streamRemaining = useCallback(async (branchId: string, afterKey: string, seq: number) => {
    let cursor = afterKey
    try {
      while (true) {
        const res = await fetch(`/api/keys?projectId=${project.id}&branch=${branchId}&after=${encodeURIComponent(cursor)}&limit=${LOAD_PAGE}`)
        if (loadSeqRef.current !== seq) return // superseded by a newer load
        const json = await res.json() as { data?: KeyWithTranslations[] }
        const page = json.data ?? []
        if (!res.ok || page.length === 0) break
        // Dedupe: a key created during streaming can also fall into a later
        // page, and handleKeyCreated may have prepended it already.
        setKeys((prev) => {
          const seen = new Set(prev.map((k) => k.id))
          const fresh = page.filter((k) => !seen.has(k.id))
          return fresh.length ? [...prev, ...fresh] : prev
        })
        cursor = page[page.length - 1]!.key
        if (page.length < LOAD_PAGE) break
      }
    } finally {
      if (loadSeqRef.current === seq) setLoadingMore(false)
    }
  }, [project.id])

  // On mount, stream the keys beyond the server's first window.
  useEffect(() => {
    if (initialKeys.length >= totalKeyCount || initialKeys.length === 0) return
    // React dev StrictMode runs mount effects twice; guard this background
    // stream so dev doesn't issue duplicate /api/keys page requests.
    if (initialStreamStartedRef.current) return
    initialStreamStartedRef.current = true
    const seq = ++loadSeqRef.current
    void streamRemaining(initialBranchId, initialKeys[initialKeys.length - 1]!.key, seq)
    // Mount-only: initialKeys/initialBranchId are the server's first window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!resizingSidebar) return

    const onMouseMove = (event: MouseEvent) => {
      const start = sidebarResizeRef.current
      if (!start) return
      const nextWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, start.startWidth + event.clientX - start.startX)
      )
      setSidebarWidth(nextWidth)
    }

    const stopResize = () => {
      sidebarResizeRef.current = null
      setResizingSidebar(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopResize)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopResize)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingSidebar, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH])

  useEffect(() => {
    if (!resizingColumnId) return

    const onMouseMove = (event: MouseEvent) => {
      const start = columnResizeRef.current
      if (!start) return
      const nextWidth = Math.min(
        start.max,
        Math.max(start.min, start.startWidth + event.clientX - start.startX)
      )
      if (start.columnId === 'key') {
        setKeyColWidth(nextWidth)
      } else {
        setLocaleColWidths((prev) => {
          const next = new Map(prev)
          next.set(start.columnId, nextWidth)
          return next
        })
      }
    }

    const stopResize = () => {
      columnResizeRef.current = null
      setResizingColumnId(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopResize)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopResize)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingColumnId])

  // Load a whole branch in windows: first page replaces, rest stream in.
  const loadBranchWindowed = useCallback(async (branchId: string) => {
    const seq = ++loadSeqRef.current
    setSwitchingBranch(true)
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/keys?projectId=${project.id}&branch=${branchId}&limit=${LOAD_PAGE}`)
      if (loadSeqRef.current !== seq) return
      const json = await res.json() as { data?: KeyWithTranslations[]; total?: number; error?: string }
      if (!res.ok || !json.data) { toast.error(json.error ?? 'Failed to load branch'); setLoadingMore(false); return }
      setKeys(json.data)
      setSwitchingBranch(false)
      const total = json.total ?? json.data.length
      if (json.data.length < total && json.data.length > 0) {
        void streamRemaining(branchId, json.data[json.data.length - 1]!.key, seq)
      } else {
        setLoadingMore(false)
      }
    } catch {
      toast.error('Network error')
      setLoadingMore(false)
    } finally {
      setSwitchingBranch(false)
    }
  }, [project.id, streamRemaining])

  // Switch branch client-side: reload only cell content, preserve all layout.
  const handleSwitchBranch = useCallback(async (branchId: string) => {
    if (branchId === activeBranchId || switchingBranch) return
    setActiveBranchId(branchId)
    // Clear transient per-branch UI; keep column layout
    setSelectedRows(new Set())
    setSelectedKeyId(null)
    setEditingCell(null)
    // Update URL without a full navigation (no loading flash, no remount)
    window.history.replaceState(null, '', `/${project.id}/editor?branch=${branchId}`)
    await loadBranchWindowed(branchId)
  }, [activeBranchId, switchingBranch, project.id, loadBranchWindowed])

  // Reload the active branch's cell content (after a merge into it, etc.)
  const reloadActiveBranch = useCallback(async () => {
    await loadBranchWindowed(activeBranchId)
  }, [activeBranchId, loadBranchWindowed])

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

  const keyTree = useMemo(
    () => buildTranslationKeyTree(keys.map((key) => ({ id: key.id, key: key.key }))),
    [keys]
  )
  const checkedTreeKeyIds = useMemo(
    () => resolveCheckedTranslationKeyIds(keyTree, checkedKeyTreeNodeIds),
    [keyTree, checkedKeyTreeNodeIds]
  )
  const folderPathNames = useMemo(() => {
    const names = new Set<string>()
    const visit = (node: TranslationKeyTreeNode) => {
      if (node.kind === 'folder') names.add(node.path)
      for (const child of node.children) visit(child)
    }
    visit(keyTree)
    return names
  }, [keyTree])
  const expandableKeyTreeNodeIds = useMemo(() => {
    const ids: string[] = []
    const visit = (node: TranslationKeyTreeNode) => {
      if (node.children.length > 0) ids.push(node.id)
      for (const child of node.children) visit(child)
    }
    visit(keyTree)
    return ids
  }, [keyTree])
  const toggleKeyTreeChecked = useCallback((nodeId: string) => {
    setCheckedKeyTreeNodeIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])
  const toggleKeyTreeExpanded = useCallback((nodeId: string) => {
    setExpandedKeyTreeNodeIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])
  const expandAllKeyTreeNodes = useCallback(() => {
    setExpandedKeyTreeNodeIds(new Set(expandableKeyTreeNodeIds))
  }, [expandableKeyTreeNodeIds])
  const collapseAllKeyTreeNodes = useCallback(() => {
    setExpandedKeyTreeNodeIds(new Set([KEY_TREE_ROOT_ID]))
  }, [])

  // Filtered keys
  const filteredKeys = useMemo(() => {
    let result = keys

    if (checkedTreeKeyIds) {
      result = result.filter((k) => checkedTreeKeyIds.has(k.id))
    }

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
  }, [keys, checkedTreeKeyIds, search, filterStatus, selectedLocaleId, columnFilters, locales])

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

    // Root-level keys (no dots — no namespace). Do not re-add namespaced
    // keys that are hidden by a collapsed group, otherwise they leak back into
    // the root and can appear duplicated in Group view.
    for (const key of filteredKeys) {
      if (!key.key.includes('.') && !addedIds.has(key.id)) {
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
  useEffect(() => { setSelRange(null) }, [search, filterStatus, selectedLocaleId, checkedKeyTreeNodeIds, groupBy])

  // Stats
  const stats = useMemo(() => {
    const totalKeys = keys.length
    // Key-level status counts (via keyOverallStatus) — used in sidebar + StatsBar
    const keyCounts = { empty: 0, pending: 0, reviewed: 0, approved: 0 }
    for (const key of keys) {
      const s = keyOverallStatus(key, locales)
      if (s in keyCounts) keyCounts[s as keyof typeof keyCounts]++
    }
    // Per-locale: count of keys where that locale needs work + approved percent
    const localeNeedsWork = new Map<string, number>()
    const localePercent = new Map<string, number>()
    // Approved records for the overall progress bar. Normally scored over the
    // target (non-base) locales; if the project has only the base locale, the
    // base counts so progress reflects the user's work instead of staying 0%.
    const hasTargets = locales.some((l) => !l.is_base)
    let approvedRecords = 0
    for (const locale of locales) {
      let needsWork = 0
      let approved = 0
      for (const key of keys) {
        const t = key.translations.find((tr) => tr.locale_id === locale.id)
        if (!t || !t.value || t.status === 'empty' || t.status === 'pending') needsWork++
        if (t?.status === 'approved') approved++
      }
      // Per-locale stats cover every locale (incl. base) for the sidebar
      // counter and column-header percent.
      if (needsWork > 0) localeNeedsWork.set(locale.id, needsWork)
      localePercent.set(locale.id, totalKeys > 0 ? Math.round((approved / totalKeys) * 100) : 0)
      const isScored = hasTargets ? !locale.is_base : true
      if (isScored) approvedRecords += approved
    }
    return {
      total: totalKeys,
      approvedRecords,
      ...keyCounts,
      localeNeedsWork,
      localePercent,
    }
  }, [keys, locales])

  // Overall %: approved records / (keys × scored locales). Scored = non-base
  // locales, or the base alone when it's the only locale (matches stats above).
  const overallPercent = useMemo(() => {
    const nonBaseCount = locales.filter((l) => !l.is_base).length
    const scoredCount = nonBaseCount > 0 ? nonBaseCount : locales.length
    const total = keys.length * scoredCount
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
                id: update.id,
                key_id: update.key_id, locale_id: update.locale_id,
                value: update.value, status: update.status,
              },
            ],
          }
        })
      )
    },
    []
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
    getItemKey: (i) => {
      const row = virtualRows[i]
      return row ? virtualRowKey(row) : `missing:${i}`
    },
    estimateSize: (i) => virtualRows[i]?.type === 'group' ? 32 : 84,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 8,
  })

  const pendingTreeScrollKeyRef = useRef<string | null>(null)
  const scrollToKey = useCallback((keyId: string) => {
    const rowIndex = virtualRows.findIndex((row) => row.type === 'key' && row.item.id === keyId)
    if (rowIndex < 0) {
      const key = keys.find((item) => item.id === keyId)
      const isVisibleAfterFilters = filteredKeys.some((item) => item.id === keyId)
      if (!key || !isVisibleAfterFilters) {
        toast.info('This key is hidden by the active filters')
        return
      }

      if (groupBy) {
        const parts = key.key.split('.').filter(Boolean)
        const ancestorPaths = parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('.'))
        if (ancestorPaths.length > 0) {
          pendingTreeScrollKeyRef.current = keyId
          setCollapsedGroups((prev) => {
            const next = new Set(prev)
            for (const path of ancestorPaths) next.delete(path)
            return next
          })
          return
        }
      }

      toast.info('This key is hidden by the active filters')
      return
    }
    virtualizer.scrollToIndex(rowIndex, { align: 'center' })
  }, [virtualRows, virtualizer, keys, filteredKeys, groupBy])

  useEffect(() => {
    const keyId = pendingTreeScrollKeyRef.current
    if (!keyId) return
    const rowIndex = virtualRows.findIndex((row) => row.type === 'key' && row.item.id === keyId)
    if (rowIndex < 0) return
    pendingTreeScrollKeyRef.current = null
    virtualizer.scrollToIndex(rowIndex, { align: 'center' })
  }, [virtualRows, virtualizer])

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
                key_id: keyId, locale_id: localeId, value, status,
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

  // Select every cell in a column (Excel-style column-header click). Reuses the
  // cell range selection, so the CellActionBar / copy / clear all work as usual.
  const selectColumn = useCallback((colIndex: number) => {
    const last = rowOrder.length - 1
    if (last < 0) return
    setEditingCell(null)
    setSelRange({ anchor: { row: 0, col: colIndex }, focus: { row: last, col: colIndex } })
  }, [rowOrder.length])

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
  const getLocaleColWidth = useCallback(
    (localeId: string) => localeColWidths.get(localeId) ?? DEFAULT_COLS.locale,
    [localeColWidths, DEFAULT_COLS.locale]
  )
  const startColumnResize = useCallback((
    event: React.MouseEvent,
    columnId: string,
    startWidth: number,
    min: number,
    max: number,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    columnResizeRef.current = { columnId, startX: event.clientX, startWidth, min, max }
    setResizingColumnId(columnId)
  }, [])
  const resetColumnWidths = useCallback(() => {
    setKeyColWidth(DEFAULT_COLS.key)
    setLocaleColWidths(new Map())
  }, [DEFAULT_COLS.key])
  const equalizeLocaleColumnWidths = useCallback(() => {
    if (locales.length === 0) return
    const total = locales.reduce((sum, locale) => sum + getLocaleColWidth(locale.id), 0)
    const average = Math.round(total / locales.length)
    const width = Math.min(LOCALE_COL_MAX_WIDTH, Math.max(LOCALE_COL_MIN_WIDTH, average))
    setLocaleColWidths(new Map(locales.map((locale) => [locale.id, width])))
  }, [locales, getLocaleColWidth, LOCALE_COL_MAX_WIDTH, LOCALE_COL_MIN_WIDTH])

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
    map.set('check', offset); offset += DEFAULT_COLS.check
    if (showKey && frozenCols.has('key')) { map.set('key', offset); offset += keyColWidth }
    for (const l of visibleLocales) {
      if (!frozenCols.has(l.id)) break
      map.set(l.id, offset); offset += getLocaleColWidth(l.id)
    }
    return map
  }, [showKey, frozenCols, visibleLocales, DEFAULT_COLS.check, keyColWidth, getLocaleColWidth])

  const gridCols = [
    `${DEFAULT_COLS.check}px`,
    showKey ? `${keyColWidth}px` : null,
    ...visibleLocales.map((locale) => `${getLocaleColWidth(locale.id)}px`),
    showStatus ? `${DEFAULT_COLS.status}px` : null,
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

  // Serialize all translation writes (edit, paste, clear, approve/review,
  // undo/redo). Fire-and-forget POSTs can otherwise complete out of order —
  // rapid undo/redo would let an earlier request commit last, so the DB (and
  // the realtime echo) ends up on the wrong value. Chaining guarantees the
  // server processes them in click order.
  const writeChainRef = useRef<Promise<unknown>>(Promise.resolve())
  // Count of queued + in-flight writes, to drive a "Saving…" indicator and to
  // block undo/redo while a write is still settling. The ref mirrors the state
  // so the once-bound keydown handler can read it without re-binding.
  const [pendingWrites, setPendingWrites] = useState(0)
  const pendingWritesRef = useRef(0)
  const enqueueWrite = useCallback(
    (body: unknown, opts?: { errorMsg?: string; onSuccess?: () => void }) => {
      pendingWritesRef.current += 1
      setPendingWrites((n) => n + 1)
      const run = writeChainRef.current.then(async () => {
        try {
          const res = await fetch('/api/translations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) {
            const json = await res.json().catch(() => ({})) as { error?: string }
            toast.error(json.error ?? opts?.errorMsg ?? 'Update failed')
          } else {
            opts?.onSuccess?.()
          }
        } catch {
          toast.error('Network error')
        } finally {
          pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1)
          setPendingWrites((n) => Math.max(0, n - 1))
        }
      })
      // Keep the chain alive regardless of this link's outcome.
      writeChainRef.current = run.catch(() => {})
      return run
    },
    []
  )

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
              key_id: k.id, locale_id: it.localeId, value: it.value, status: it.status,
            })
          }
        }
        return { ...k, translations: trans }
      })
    )

    // Persist
    void enqueueWrite({ branchId: activeBranchId, items }, {
      errorMsg: 'Paste failed',
      onSuccess: () => toast.success(
        `Pasted ${items.length} cell${items.length > 1 ? 's' : ''}` +
        (lockedSkipped ? ` · ${lockedSkipped} locked skipped` : '')
      ),
    })
  }, [pushUndo, canEdit, activeBranchId, enqueueWrite])

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

    void enqueueWrite({ branchId: activeBranchId, items }, {
      errorMsg: 'Clear failed',
      onSuccess: () => toast.success(`Cleared ${items.length} cell${items.length > 1 ? 's' : ''}`),
    })
  }, [pushUndo, canEdit, activeBranchId, enqueueWrite])

  // Set status (approved/reviewed) on every non-empty, non-locked cell in the
  // selection — the cell-range counterpart of BulkActionBar's Approve/Review.
  const setSelectionStatus = useCallback((newStatus: 'approved' | 'reviewed') => {
    if (!canReview) return
    const { selRange: sel, rowOrder: order, visibleLocales: vis, lockedCols: locked, keys: cur } = latestRef.current
    if (!sel) return
    const r0 = Math.min(sel.anchor.row, sel.focus.row), r1 = Math.max(sel.anchor.row, sel.focus.row)
    const c0 = Math.min(sel.anchor.col, sel.focus.col), c1 = Math.max(sel.anchor.col, sel.focus.col)
    const keyById = new Map(cur.map((k) => [k.id, k]))

    const items: { keyId: string; localeId: string; value: string }[] = []
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
        if (!t?.value || !t.value.trim()) continue          // can't review/approve an empty cell
        if (t.status === newStatus) continue                // already at target
        if (newStatus === 'reviewed' && t.status === 'approved') continue // don't downgrade approved
        items.push({ keyId, localeId: locale.id, value: t.value })
        changes.push({
          keyId, localeId: locale.id,
          before: { value: t.value, status: t.status ?? 'empty' },
          after: { value: t.value, status: newStatus },
        })
      }
    }
    if (items.length === 0) {
      if (lockedSkipped) toast.error('Selected column is locked')
      else toast.info(newStatus === 'approved' ? 'No translations to approve' : 'No eligible translations to review')
      return
    }
    pushUndo(changes)

    const targetSet = new Set(items.map((it) => `${it.keyId}:${it.localeId}`))
    setKeys((prev) =>
      prev.map((k) => ({
        ...k,
        translations: k.translations.map((tr) =>
          targetSet.has(`${k.id}:${tr.locale_id}`) ? { ...tr, status: newStatus } : tr
        ),
      }))
    )

    void enqueueWrite({ branchId: activeBranchId, status: newStatus, items }, {
      onSuccess: () => toast.success(
        `${newStatus === 'approved' ? 'Approved' : 'Marked as reviewed'} ${items.length} cell${items.length > 1 ? 's' : ''}` +
        (lockedSkipped ? ` · ${lockedSkipped} locked skipped` : '')
      ),
    })
  }, [pushUndo, canReview, activeBranchId, enqueueWrite])

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
              key_id: k.id, locale_id: it.localeId, value: it.value, status: it.status,
            })
          }
        }
        return { ...k, translations: trans }
      })
    )
    void enqueueWrite({ branchId: activeBranchId, items: cells })
  }, [activeBranchId, enqueueWrite])

  const undo = useCallback(() => {
    if (pendingWritesRef.current > 0) return // wait for the in-flight write to settle
    const changes = undoRef.current.pop()
    if (!changes) return
    redoRef.current.push(changes)
    setHistTick((t) => t + 1)
    commitCells(changes.map((c) => ({ keyId: c.keyId, localeId: c.localeId, value: c.before.value, status: c.before.status })))
    toast.success('Undo')
  }, [commitCells])

  const redo = useCallback(() => {
    if (pendingWritesRef.current > 0) return // wait for the in-flight write to settle
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
      // Ignore clicks on a cell, the cell-selection action bar, or a control
      // marked keep-selection (e.g. scroll-to-top) — otherwise clicking them
      // would clear the selection (and the resulting layout shift swallows the click).
      if (
        target?.closest('[data-cell]') ||
        target?.closest('[data-cell-actions]') ||
        target?.closest('[data-keep-selection]')
      ) return
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

  // Auto-scroll while drag-selecting past the top/bottom edge. onMouseEnter only
  // fires when the pointer moves over a cell, so a stationary pointer held at the
  // edge wouldn't scroll or extend the selection — this rAF loop does both by
  // scrolling the container and re-resolving the cell under the pointer.
  useEffect(() => {
    const EDGE = 56       // px zone from the top/bottom edge that triggers scroll
    const MAX_SPEED = 22  // max px scrolled per frame (at the very edge)
    const pointer = { x: 0, y: 0 }
    let raf: number | null = null

    const cellAtPoint = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      const cell = el?.closest('[data-cell]') as HTMLElement | null
      if (!cell || cell.dataset.row == null || cell.dataset.col == null) return null
      return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) }
    }

    const step = () => {
      const sc = scrollRef.current
      if (!pointerDownRef.current || !sc) { raf = null; return }
      const rect = sc.getBoundingClientRect()
      let dy = 0
      if (pointer.y > rect.bottom - EDGE) {
        dy = Math.min(MAX_SPEED, ((pointer.y - (rect.bottom - EDGE)) / EDGE) * MAX_SPEED)
      } else if (pointer.y < rect.top + EDGE) {
        dy = -Math.min(MAX_SPEED, (((rect.top + EDGE) - pointer.y) / EDGE) * MAX_SPEED)
      }
      if (dy === 0) { raf = null; return } // pointer left the edge zone — stop looping
      sc.scrollTop += dy
      // Selection follows the cell now under the pointer. Clamp the probe inside
      // the scroll body so the sticky header row isn't picked at the top edge.
      const probeY = Math.max(rect.top + 44, Math.min(rect.bottom - 2, pointer.y))
      const hit = cellAtPoint(pointer.x, probeY)
      if (hit) {
        didDragRef.current = true
        setSelRange((prev) => (prev ? { anchor: prev.anchor, focus: hit } : prev))
      }
      raf = requestAnimationFrame(step)
    }

    const onMove = (e: MouseEvent) => {
      if (!pointerDownRef.current) return
      pointer.x = e.clientX
      pointer.y = e.clientY
      const sc = scrollRef.current
      if (!sc) return
      const rect = sc.getBoundingClientRect()
      const nearEdge = e.clientY > rect.bottom - EDGE || e.clientY < rect.top + EDGE
      if (nearEdge && raf == null) raf = requestAnimationFrame(step)
    }

    const stop = () => { if (raf != null) { cancelAnimationFrame(raf); raf = null } }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', stop)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', stop)
      stop()
    }
  }, [])

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

  // Active-filter chips — one per enabled filter, so the AND-combination is
  // visible and each can be removed individually (or all at once).
  const STATUS_LABEL: Record<Exclude<FilterStatus, 'all'>, string> = {
    empty: 'Untranslated', pending: 'Pending', reviewed: 'Reviewed', approved: 'Approved',
  }
  const activeFilters: { key: string; label: string; onRemove: () => void }[] = []
  if (search) {
    activeFilters.push({ key: 'search', label: `Search: “${search}”`, onRemove: () => setSearch('') })
  }
  if (filterStatus !== 'all') {
    activeFilters.push({ key: 'status', label: `Status: ${STATUS_LABEL[filterStatus]}`, onRemove: () => setFilterStatus('all') })
  }
  if (selectedLocaleId) {
    const loc = locales.find((l) => l.id === selectedLocaleId)
    activeFilters.push({ key: 'lang', label: `Needs work: ${loc?.name ?? '—'}`, onRemove: () => setSelectedLocaleId(null) })
  }
  if (checkedKeyTreeNodeIds.size > 0) {
    activeFilters.push({
      key: 'key-tree',
      label: `Key tree: ${checkedKeyTreeNodeIds.size} selected`,
      onRemove: () => setCheckedKeyTreeNodeIds(new Set()),
    })
  }
  columnFilters.forEach((st, localeId) => {
    if (st === 'all') return
    const loc = locales.find((l) => l.id === localeId)
    activeFilters.push({
      key: `col-${localeId}`,
      label: `${(loc?.code ?? '').toUpperCase()}: ${STATUS_LABEL[st]}`,
      onRemove: () => setColumnFilters((prev) => { const n = new Map(prev); n.delete(localeId); return n }),
    })
  })
  const clearAllFilters = () => {
    setSearch('')
    setFilterStatus('all')
    setSelectedLocaleId(null)
    setCheckedKeyTreeNodeIds(new Set())
    setColumnFilters(new Map())
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* ── TopNav ── */}
      <header className="h-12 border-b border-border flex items-center px-4 gap-3 flex-shrink-0 bg-background/95 backdrop-blur">
        {/* Logo + breadcrumb */}
        <Link href="/projects" className="flex items-center gap-2 shrink-0 group">
          <Logo size={24} />
          <span className="font-semibold text-sm text-foreground group-hover:text-foreground transition-colors hidden lg:block">
            LangHub
          </span>
        </Link>
        <span className="text-border text-sm select-none px-0.5">/</span>
        <span className="text-sm text-muted-foreground truncate max-w-[160px]" title={project.name}>
          {project.name}
        </span>
        <span className="text-border text-sm select-none px-0.5">/</span>
        <span className="text-sm text-foreground font-medium">Editor</span>

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

        {/* Saving indicator — queued/in-flight translation writes */}
        {pendingWrites > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1" title="Saving your changes…">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="hidden sm:inline">Saving…</span>
          </span>
        )}

        {/* Progress */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground mr-1">
          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          <span>{overallPercent}%</span>
        </div>

        <div className="w-px h-4 bg-muted" />

        {/* Data operations */}
        <div className="flex items-center">
          {canManage && (
            <Link href={`/${project.id}/import?branch=${activeBranchId}`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Import</span>
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => setShowExport(true)}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Export</span>
          </Button>
        </div>

        <div className="w-px h-4 bg-muted" />

        {/* Languages config */}
        {canManage && <ManageLocalesDialog project={project} onLocalesChanged={() => {}} />}

        {/* Overflow menu: Duplicates, Versions, AI Translate */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="More options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1 bg-card border-border" align="end">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Navigate</p>
            <Link href={`/${project.id}/keys`}>
              <button className="w-full text-left text-xs text-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted/60 flex items-center gap-2">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                Duplicates
              </button>
            </Link>
            <Link href={`/${project.id}/branches`}>
              <button className="w-full text-left text-xs text-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted/60 flex items-center gap-2">
                <GitBranchIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Branches
              </button>
            </Link>
            <Link href={`/${project.id}/versions`}>
              <button className="w-full text-left text-xs text-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted/60 flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                Versions
              </button>
            </Link>
            <div className="border-t border-border my-1" />
            <button
              className="w-full text-left text-xs text-muted-foreground cursor-not-allowed px-2 py-1.5 rounded flex items-center gap-2"
              onClick={() => toast.info('AI Translation — Coming Soon')}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Translate
              <span className="ml-auto text-[10px] bg-muted text-muted-foreground rounded px-1">Soon</span>
            </button>
          </PopoverContent>
        </Popover>

        <ThemeHeaderButton />

        <div className="w-px h-4 bg-muted" />

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
          <PopoverContent className="w-56 p-3 bg-card border-border" align="end">
            {/* Email */}
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ backgroundColor: stringToColor(user.email ?? user.id) }}
              >
                {(user.email?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-foreground truncate font-medium">{user.email ?? 'Unknown'}</p>
                <span className={cn(
                  'inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5',
                  user.role === 'owner'      ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' :
                  user.role === 'admin'      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
                  user.role === 'translator' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' :
                                               'bg-muted text-muted-foreground'
                )}>
                  {user.role}
                </span>
              </div>
            </div>
            <div className="border-t border-border -mx-3 mb-2" />
            <Link href="/projects" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-1 py-1 rounded hover:bg-muted/60 transition-colors">
              <LogOut className="h-3.5 w-3.5" />
              Back to projects
            </Link>
            <button
              onClick={() => void signOut()}
              className="w-full text-left flex items-center gap-2 text-xs text-destructive hover:text-red-700 dark:text-red-300 px-1 py-1 rounded hover:bg-muted/60 transition-colors mt-0.5"
            >
              <LogOut className="h-3.5 w-3.5 rotate-180" />
              Sign out
            </button>
          </PopoverContent>
        </Popover>
      </header>

      {/* ── Toolbar ── */}
      <div className="h-11 border-b border-border flex items-center px-4 gap-2 flex-shrink-0 bg-card/60">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keys or values…"
            className="h-7 pl-8 pr-3 text-xs w-56 bg-card border-border placeholder:text-muted-foreground"
          />
        </div>

        {/* Streaming indicator — search/filter act on loaded keys only until done */}
        {loadingMore && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground" title="Loading remaining keys — search and filters cover loaded keys only until this finishes">
            <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
            Loading {keys.length}<span className="text-border">/{totalKeyCount}</span>
          </span>
        )}

        <div className="flex-1" />

        {/* Undo / Redo */}
        <div className="flex items-center">
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => undo()}
            disabled={undoRef.current.length === 0 || pendingWrites > 0}
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => redo()}
            disabled={redoRef.current.length === 0 || pendingWrites > 0}
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="w-px h-4 bg-muted" />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                'h-7 text-xs gap-1.5',
                (hiddenCols.size > 0 || lockedCols.size > 0 || frozenCols.size > 1 || localeOrder.length > 0 || keyColWidth !== DEFAULT_COLS.key || localeColWidths.size > 0)
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-950/60'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Configure columns"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1 bg-card border-border" align="end">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Columns</p>
            {/* Key column */}
            {(() => {
              const hidden = hiddenCols.has('key')
              const frozen = frozenCols.has('key')
              return (
                <div className="flex items-center gap-0.5 px-2 py-1 rounded hover:bg-muted/60">
                  <span className="flex-1 text-xs text-foreground">Key name</span>
                  <button
                    onClick={() => setFrozenCols((p) => { const n = new Set(p); if (frozen) n.delete('key'); else n.add('key'); return n })}
                    className={cn('p-1 rounded', frozen ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300' : 'text-muted-foreground hover:text-foreground')}
                    title={frozen ? 'Unfreeze column' : 'Freeze column (stays visible when scrolling)'}
                  >
                    {frozen ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => setHiddenCols((p) => { const n = new Set(p); if (hidden) n.delete('key'); else n.add('key'); return n })}
                    className={cn('p-1 rounded', hidden ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground hover:text-foreground')}
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
                <div className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/60">
                  <span className="flex-1 text-xs text-foreground">Status</span>
                  <button
                    onClick={() => setHiddenCols((p) => { const n = new Set(p); if (hidden) n.delete('status'); else n.add('status'); return n })}
                    className={cn('p-1 rounded', hidden ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    title={hidden ? 'Show' : 'Hide'}
                  >
                    {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              )
            })()}
            <div className="border-t border-border my-1" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">Languages</p>
            {locales.map((locale) => {
              const hidden = hiddenCols.has(locale.id)
              const frozen = frozenCols.has(locale.id)
              const locked = lockedCols.has(locale.id)
              return (
                <div key={locale.id} className="flex items-center gap-0.5 px-2 py-1 rounded hover:bg-muted/60">
                  <span className="text-sm">{getFlag(locale.code)}</span>
                  <span className="flex-1 text-xs text-foreground truncate ml-1">{locale.name}</span>
                  <button
                    onClick={() => setFrozenCols((p) => { const n = new Set(p); if (frozen) n.delete(locale.id); else n.add(locale.id); return n })}
                    className={cn('p-1 rounded', frozen ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300' : 'text-muted-foreground hover:text-foreground')}
                    title={frozen ? 'Unfreeze column' : 'Freeze column (stays visible when scrolling)'}
                  >
                    {frozen ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => setLockedCols((p) => { const n = new Set(p); if (locked) n.delete(locale.id); else n.add(locale.id); return n })}
                    className={cn('p-1 rounded', locked ? 'text-orange-400 hover:text-orange-300' : 'text-muted-foreground hover:text-foreground')}
                    title={locked ? 'Unlock (allow editing)' : 'Lock (read-only)'}
                  >
                    {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => setHiddenCols((p) => { const n = new Set(p); if (hidden) n.delete(locale.id); else n.add(locale.id); return n })}
                    className={cn('p-1 rounded', hidden ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    title={hidden ? 'Show' : 'Hide'}
                  >
                    {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              )
            })}
            <div className="border-t border-border my-1" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">Widths</p>
            <button
              onClick={resetColumnWidths}
              className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted/60"
            >
              Reset widths
            </button>
            <button
              onClick={equalizeLocaleColumnWidths}
              className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted/60"
            >
              Equalize language widths
            </button>
            {(hiddenCols.size > 0 || lockedCols.size > 0 || frozenCols.size > 1 || localeOrder.length > 0 || keyColWidth !== DEFAULT_COLS.key || localeColWidths.size > 0) && (
              <>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => { setHiddenCols(new Set()); setFrozenCols(new Set(['key'])); setLockedCols(new Set()); setLocaleOrder([]); resetColumnWidths() }}
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted/60"
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
            groupBy ? 'text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-950/60' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setGroupBy((v) => !v)}
          title="Group by namespace"
        >
          <Layers2 className="h-3.5 w-3.5" />
          Group
        </Button>

        <div className="w-px h-4 bg-muted" />

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
          <div className="h-7 border-b border-border/50 flex-shrink-0 overflow-hidden relative">
            <div
              className={cn(
                'absolute inset-0 bg-blue-100/60 dark:bg-blue-950/30 flex items-center px-4 gap-2 transition-opacity duration-300',
                visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            >
              <div className="flex -space-x-1">
                {active.slice(0, 4).map((p) => (
                  <div
                    key={p.userId}
                    className="w-4 h-4 rounded-full border border-border flex items-center justify-center text-[8px] font-bold"
                    style={{ backgroundColor: p.color }}
                    title={p.email}
                  >
                    {(p.email[0] ?? '?').toUpperCase()}
                  </div>
                ))}
              </div>
              <span className="text-xs text-blue-700 dark:text-blue-300/70">
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
        <aside
          className="flex flex-col flex-shrink-0 overflow-hidden bg-background"
          style={{ width: sidebarWidth }}
        >
          {/* Status filters */}
          <div className="flex-shrink-0 p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Status
                <Tooltip
                  side="right"
                  content="Filters by each key's overall status across all target languages. Selecting one clears the language filter below."
                >
                  <Info className="h-3 w-3 text-muted-foreground hover:text-muted-foreground" />
                </Tooltip>
              </span>
              {filteredKeys.length !== stats.total && (
                <span className="text-[10px] text-muted-foreground">
                  {filteredKeys.length}<span className="text-border"> / {stats.total}</span>
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
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
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
                      item.id === 'empty' ? 'text-amber-700 dark:text-amber-400' :
                      item.id === 'approved' ? 'text-emerald-500/70' : 'text-muted-foreground'
                    )}>
                      {item.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Language focus */}
          <div className="flex-shrink-0 border-t border-border p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">
              By language
              <Tooltip
                side="right"
                content="Click a language to show only keys that still need work (empty or pending) in it. The number is how many remain. This resets the Status filter to All."
              >
                <Info className="h-3 w-3 text-muted-foreground hover:text-muted-foreground" />
              </Tooltip>
            </div>
            {locales.map((locale) => {
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
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  )}
                >
                  <span className="text-sm leading-none">{getFlag(locale.code)}</span>
                  <span className="flex-1 text-left truncate">{locale.name}</span>
                  {locale.is_base && (
                    <span className="text-[9px] text-muted-foreground border border-border rounded px-1">base</span>
                  )}
                  {needsWork > 0 ? (
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 tabular-nums">{needsWork}</span>
                  ) : (
                    <span className="text-[10px] text-emerald-500/70">✓</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Nested key tree */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-border p-3">
            <div className="mb-2 flex flex-shrink-0 items-center justify-between gap-2 px-1">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Key tree
                <Tooltip
                  side="right"
                  content="Filter by nested key folders. Checking a folder includes all descendant keys; checking a leaf includes that exact key."
                >
                  <Info className="h-3 w-3 text-muted-foreground hover:text-muted-foreground" />
                </Tooltip>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={expandAllKeyTreeNodes}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Expand all folders"
                  aria-label="Expand all key tree folders"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={collapseAllKeyTreeNodes}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Collapse all folders"
                  aria-label="Collapse all key tree folders"
                >
                  <Folder className="h-3.5 w-3.5" />
                </button>
                {checkedKeyTreeNodeIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setCheckedKeyTreeNodeIds(new Set())}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <KeyTreeNodeRow
                node={keyTree}
                depth={0}
                checkedNodeIds={checkedKeyTreeNodeIds}
                expandedNodeIds={expandedKeyTreeNodeIds}
                onToggleChecked={toggleKeyTreeChecked}
                onToggleExpanded={toggleKeyTreeExpanded}
                onLeafClick={scrollToKey}
                ambiguousKeyNames={folderPathNames}
              />
            </div>
          </div>
        </aside>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize sidebar"
          className={cn(
            'group relative z-20 w-1 flex-shrink-0 cursor-col-resize bg-muted transition-colors hover:bg-blue-500/60',
            resizingSidebar && 'bg-blue-500/80'
          )}
          onMouseDown={(event) => {
            event.preventDefault()
            sidebarResizeRef.current = { startX: event.clientX, startWidth: sidebarWidth }
            setResizingSidebar(true)
          }}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Table */}
        <div className="flex flex-col flex-1 overflow-hidden relative">
          {/* Active filters — makes the combined (AND) filter state visible */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap px-3 py-1.5 border-b border-border bg-background/60">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Filters
                <Tooltip
                  side="bottom"
                  content="All active filters apply together (AND). Remove one with ×, or Clear all to reset everything."
                >
                  <Info className="h-3 w-3 text-muted-foreground hover:text-muted-foreground" />
                </Tooltip>
              </span>
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={f.onRemove}
                  className="group flex items-center gap-1 rounded-full border border-border bg-muted/60 pl-2 pr-1 py-0.5 text-xs text-foreground hover:border-border hover:bg-muted"
                >
                  <span className="max-w-[200px] truncate">{f.label}</span>
                  <X className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                </button>
              ))}
              <button
                onClick={clearAllFilters}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto"
            onScroll={(e) => {
              const target = e.target as HTMLDivElement
              setShowScrollTop(target.scrollTop > 400)
              setTableScrolled(target.scrollTop > 0)
              setTableScrolledX(target.scrollLeft > 0)
              setTableScrollTop(target.scrollTop)
            }}
          >
            {/* Sticky header */}
            <div
              className={cn(
                'sticky top-0 z-30 grid min-w-max border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 transition-shadow',
                tableScrolled && 'shadow-[0_10px_24px_rgba(15,23,42,0.08)] ring-1 ring-inset ring-slate-900/5 dark:shadow-[0_10px_24px_rgba(0,0,0,0.45)] dark:ring-white/5'
              )}
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Checkbox — viewer excluded */}
              <div
                className={cn(
                  'flex items-center justify-center h-10 sticky z-40 bg-card/95 backdrop-blur',
                  tableScrolledX && 'shadow-[6px_0_14px_rgba(15,23,42,0.08)] dark:shadow-[6px_0_14px_rgba(0,0,0,0.35)]'
                )}
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
                    'relative px-3 flex items-center h-10 gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wide border-r border-border/70',
                    stickyLeft.has('key') && 'sticky z-40 bg-card/95 backdrop-blur',
                    stickyLeft.has('key') && tableScrolledX && 'shadow-[6px_0_14px_rgba(15,23,42,0.08)] dark:shadow-[6px_0_14px_rgba(0,0,0,0.35)]'
                  )}
                  style={stickyLeft.has('key') ? { left: stickyLeft.get('key') } : undefined}
                >
                  {frozenCols.has('key') && <Pin className="h-2.5 w-2.5 text-blue-500 flex-shrink-0" />}
                  Key
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize key column"
                    title="Drag to resize · Double-click to reset"
                    className={cn(
                      'absolute right-0 top-0 h-full w-1.5 cursor-col-resize transition-colors hover:bg-blue-500/70',
                      resizingColumnId === 'key' && 'bg-blue-500/80'
                    )}
                    onMouseDown={(event) => startColumnResize(event, 'key', keyColWidth, KEY_COL_MIN_WIDTH, KEY_COL_MAX_WIDTH)}
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setKeyColWidth(DEFAULT_COLS.key)
                    }}
                  />
                </div>
              )}
              {/* Locale columns */}
              {visibleLocales.map((locale, colIndex) => {
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
                const localeColWidth = getLocaleColWidth(locale.id)
                return (
                  <div
                    key={locale.id}
                    draggable
                    onDragStart={(e) => handleColDragStart(e, locale.id)}
                    onDragOver={(e) => handleColDragOver(e, locale.id)}
                    onDrop={(e) => handleColDrop(e, locale.id)}
                    onDragEnd={handleColDragEnd}
                    className={cn(
                      'relative px-2 flex items-center h-10 gap-1 text-xs font-medium text-foreground select-none border-r border-border/50',
                      isFrozen && 'sticky z-40 bg-card/95 backdrop-blur',
                      isFrozen && tableScrolledX && 'shadow-[6px_0_14px_rgba(15,23,42,0.08)] dark:shadow-[6px_0_14px_rgba(0,0,0,0.35)]',
                      isDraggingThis && 'border-l-2 border-blue-500 bg-blue-100/50 dark:bg-blue-950/20'
                    )}
                    style={isFrozen ? { left: stickyLeft.get(locale.id) } : undefined}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-border hover:text-muted-foreground cursor-grab flex-shrink-0" />
                    <Tooltip side="bottom" content="Click to select the entire column">
                      <button
                        type="button"
                        data-keep-selection="1"
                        onClick={() => selectColumn(colIndex)}
                        className="flex items-center gap-1 rounded px-1 py-0.5 cursor-pointer bg-muted/60 ring-1 ring-inset ring-zinc-700/70 hover:bg-accent/70 hover:text-foreground hover:ring-zinc-600 transition-colors"
                      >
                        <span>{getFlag(locale.code)}</span>
                        <span className="uppercase">{locale.code}</span>
                      </button>
                    </Tooltip>
                    {locale.is_base && (
                      <span className="text-[9px] text-muted-foreground border border-border rounded px-0.5">base</span>
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
                                ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                            title="Filter this column by status. Combines (AND) with other active filters — may show no rows if they conflict."
                          >
                            <ListFilter className="h-3 w-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-36 p-1 bg-card border-border" align="start">
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
                                  ? 'bg-muted text-foreground'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
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
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${locale.name} column`}
                      title="Drag to resize · Double-click to reset"
                      className={cn(
                        'absolute right-0 top-0 h-full w-1.5 cursor-col-resize transition-colors hover:bg-blue-500/70',
                        resizingColumnId === locale.id && 'bg-blue-500/80'
                      )}
                      onMouseDown={(event) => startColumnResize(event, locale.id, localeColWidth, LOCALE_COL_MIN_WIDTH, LOCALE_COL_MAX_WIDTH)}
                      onDoubleClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setLocaleColWidths((prev) => {
                          const next = new Map(prev)
                          next.delete(locale.id)
                          return next
                        })
                      }}
                    />
                  </div>
                )
              })}
              {/* Status */}
              {showStatus && (
                <div className="px-3 flex items-center h-10 gap-1 text-xs font-semibold text-foreground uppercase tracking-wide border-r border-border/50">
                  <span>Status</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          'p-0.5 rounded transition-colors',
                          filterStatus !== 'all'
                            ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        title="Filter by each key's overall status across all target languages. Same filter as the sidebar Status list."
                      >
                        <ListFilter className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-1 bg-card border-border" align="end">
                      {([
                        { id: 'all', label: 'All' },
                        { id: 'empty', label: 'Untranslated' },
                        { id: 'pending', label: 'Pending' },
                        { id: 'reviewed', label: 'Reviewed' },
                        { id: 'approved', label: 'Approved' },
                      ] as { id: FilterStatus; label: string }[]).map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { setFilterStatus(opt.id); setSelectedLocaleId(null) }}
                          className={cn(
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs normal-case tracking-normal transition-colors',
                            filterStatus === opt.id
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
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
                </div>
              )}
            </div>

            {/* Empty state */}
            {filteredKeys.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                {keys.length === 0 ? (
                  <>
                    <Upload className="h-8 w-8 mb-3 opacity-20" />
                    <p className="text-sm font-medium text-muted-foreground mb-1">No keys yet</p>
                    <p className="text-xs text-muted-foreground mb-4">Import a file or add your first key manually</p>
                    <div className="flex gap-2">
                      <Link href={`/${project.id}/import?branch=${activeBranchId}`}>
                        <Button size="sm" variant="outline" className="border-border gap-1.5">
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
                          <span className="text-blue-700 dark:text-blue-200/60 text-[10px] ml-1">⌘K</span>
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
              const stickyParent = groupBy
                ? (() => {
                    const activeIndex = vItems.find((item) => item.end > tableScrollTop)?.index
                    if (activeIndex == null) return null
                    const activeRow = virtualRows[activeIndex]
                    if (!activeRow) return null
                    const activeGroupPath = activeRow.type === 'group'
                      ? activeRow.fullPath
                      : activeRow.item.key.split('.').slice(0, -1).join('.')
                    if (!activeGroupPath) return null

                    const activeGroupIndex = virtualRows.findIndex((row) => row.type === 'group' && row.fullPath === activeGroupPath)
                    const activeGroupRow = activeGroupIndex >= 0 ? virtualRows[activeGroupIndex] : null
                    const activeGroupItem = activeGroupIndex >= 0 ? vItems.find((item) => item.index === activeGroupIndex) : undefined
                    const activeGroupIsVisible = !!activeGroupItem &&
                      activeGroupItem.start >= tableScrollTop

                    if (activeGroupIsVisible || activeGroupRow?.type !== 'group') return null
                    return { path: activeGroupPath, depth: activeGroupRow.depth }
                  })()
                : null
              const stickyParentParts = stickyParent?.path.split('.') ?? []
              return (
                <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                  {stickyParent && (
                    <div className={cn(
                      'sticky top-10 z-20 -mb-8 flex h-8 min-w-max items-center gap-1 border-b px-3 font-mono text-xs shadow-[0_8px_20px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.35)] backdrop-blur',
                      groupBarClass(stickyParent.depth)
                    )}>
                      <span className="text-[10px] uppercase tracking-wider opacity-60">Current group</span>
                      <span className={cn('flex h-5 min-w-5 items-center justify-center rounded border px-1 text-[10px] font-semibold', groupLevelClass(stickyParent.depth))}>
                        L{stickyParent.depth + 1}
                      </span>
                      {stickyParentParts.map((part, index) => (
                        <Fragment key={`${part}:${index}`}>
                          {index > 0 && <span className="text-border">/</span>}
                          <span className={cn(
                            'rounded px-1.5 py-0.5',
                            index === stickyParentParts.length - 1
                              ? 'bg-white/10 text-current ring-1 ring-inset ring-white/20'
                              : 'opacity-60'
                          )}>
                            {part}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  )}
                  <div style={{ transform: `translateY(${vItems[0]!.start}px)` }}>
                    {vItems.map((virtualRow) => {
                      const row = virtualRows[virtualRow.index]
                      if (!row) return null

                      // Group header row
                      if (row.type === 'group') {
                        const isCollapsed = collapsedGroups.has(row.fullPath)
                        const level = row.depth + 1
                        const parentPath = row.fullPath.split('.').slice(0, -1).join('.')
                        const levelClass = groupLevelClass(row.depth)
                        return (
                          <div
                            key={virtualRow.key}
                            ref={virtualizer.measureElement}
                            data-index={virtualRow.index}
                            className="flex items-center border-b border-border/50 bg-background cursor-pointer select-none min-w-max hover:bg-card/70"
                            style={{ height: '32px' }}
                            onClick={() =>
                              setCollapsedGroups((prev) => {
                                const next = new Set(prev)
                                if (next.has(row.fullPath)) next.delete(row.fullPath)
                                else next.add(row.fullPath)
                                return next
                              })
                            }
                          >
                            <div className="flex h-full items-center gap-1.5 pl-3">
                              {Array.from({ length: row.depth }).map((_, depthIndex) => (
                                <span
                                  key={depthIndex}
                                  className="h-5 w-px rounded-full bg-accent/70"
                                  aria-hidden="true"
                                />
                              ))}
                              <span className={cn('flex h-5 min-w-5 items-center justify-center rounded border px-1 text-[10px] font-semibold', levelClass)}>
                                L{level}
                              </span>
                              <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform flex-shrink-0', isCollapsed && '-rotate-90')} />
                              <span className="font-mono text-xs font-medium text-foreground">{row.label}</span>
                              {parentPath && (
                                <span className="max-w-[220px] truncate font-mono text-[10px] text-muted-foreground">
                                  in {parentPath}
                                </span>
                              )}
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{row.count}</span>
                            </div>
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
                            'group grid border-b border-border/50 min-w-max transition-colors cursor-default',
                            isActive ? 'bg-muted' : 'hover:bg-muted/40',
                            isSelected && 'bg-blue-100/70 dark:bg-blue-950/40'
                          )}
                          style={{ gridTemplateColumns: gridCols, minHeight: '84px' }}
                        >
                          {/* Checkbox — always sticky */}
                          <div
                            className={cn(
                              'flex items-start justify-center pt-2.5 sticky z-10',
                              isActive ? 'bg-muted' : 'bg-background group-hover:bg-muted',
                              isSelected && 'bg-blue-100 dark:bg-blue-950'
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
                                  isActive ? 'bg-muted' : 'bg-background group-hover:bg-muted',
                                  isSelected && 'bg-blue-100 dark:bg-blue-950'
                                )
                              )}
                              style={{
                                paddingLeft: `${12 + row.depth * 16}px`,
                                ...(frozenCols.has('key') ? { left: stickyLeft.get('key') } : {}),
                              }}
                              onClick={() => setSelectedKeyId(isActive ? null : keyItem.id)}
                            >
                              <span className="font-mono text-xs text-foreground truncate">{displayKey}</span>
                              {keyItem.description && (
                                <span className="text-[10px] text-muted-foreground truncate">{keyItem.description}</span>
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
                                  data-row={rowIndex}
                                  data-col={colIndex}
                                  className={cn('relative h-[84px] select-none', isFrozen && cn(
                                    'sticky z-10',
                                    isActive ? 'bg-muted' : 'bg-background group-hover:bg-muted',
                                    isSelected && 'bg-blue-100 dark:bg-blue-950'
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

          {/* Scroll to top */}
          {showScrollTop && (
            <button
              // Marked keep-selection so the document mousedown handler doesn't clear
              // the cell selection — that unmounts the action bar, shifts this button,
              // and makes the click land on empty space instead of scrolling.
              data-keep-selection="1"
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              title="Scroll to top"
              aria-label="Scroll to top"
              className="absolute bottom-4 right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {selectedKey && (
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
      )}

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

      {/* Cell-range action bar — shows whenever one or more cells are selected */}
      {canEdit && selBounds && (
        <CellActionBar
          cellCount={(selBounds.r1 - selBounds.r0 + 1) * (selBounds.c1 - selBounds.c0 + 1)}
          canReview={canReview}
          canEdit={canEdit}
          onDeselect={() => setSelRange(null)}
          onClearContent={clearSelection}
          onReview={() => setSelectionStatus('reviewed')}
          onApprove={() => setSelectionStatus('approved')}
        />
      )}

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
      {showAddKey && (
        <AddKeySheet
          open={showAddKey}
          projectId={project.id}
          branchId={activeBranchId}
          locales={locales}
          existingKeys={keys.map((k) => k.key)}
          onClose={() => setShowAddKey(false)}
          onCreated={handleKeyCreated}
        />
      )}

      {/* Export dialog */}
      {showExport && (
        <ExportSheet
          open={showExport}
          project={project}
          branchId={activeBranchId}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}
