'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Info, Tag, Clock, Send, Trash2, Pencil, Check, Monitor, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/utils'
import type { KeyWithTranslations } from '@/lib/supabase/queries/translations'
import type { LocaleWithStats } from '@/types'
import type { Database } from '@/types/database'

type HistoryRow = Database['public']['Tables']['translation_history']['Row'] & {
  locale: { code: string; name: string }
}
type CommentRow = Database['public']['Tables']['comments']['Row']

const FLAG_MAP: Record<string, string> = {
  en: '🇺🇸', vi: '🇻🇳', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳',
  fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸', pt: '🇧🇷', th: '🇹🇭', id: '🇮🇩',
}
function getFlag(code: string) { return FLAG_MAP[code] ?? '🌐' }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ keyId }: { keyId: string }) {
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/keys/${keyId}/history`)
      .then((r) => r.json())
      .then((d: { data?: HistoryRow[] }) => setHistory(d.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [keyId])

  if (loading) {
    return (
      <div className="space-y-2 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded bg-zinc-800/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!history.length) {
    return <p className="text-center py-8 text-zinc-600 text-sm">No history yet</p>
  }

  return (
    <div className="space-y-2">
      {history.map((h) => (
        <div key={h.id} className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm">{getFlag(h.locale.code)}</span>
            <span className="text-[11px] font-medium text-zinc-400 uppercase">{h.locale.code}</span>
            {h.new_status && <StatusBadge status={h.new_status as 'empty' | 'pending' | 'reviewed' | 'approved'} size="xs" />}
            <span className="ml-auto text-[10px] text-zinc-600">{h.changed_at ? timeAgo(h.changed_at) : ''}</span>
          </div>
          {h.old_value !== null && (
            <p className="text-[11px] text-zinc-600 line-through truncate">
              {h.old_value || <span className="italic">empty</span>}
            </p>
          )}
          <p className="text-xs text-zinc-200 break-words">
            {h.new_value || <span className="text-zinc-600 italic">empty</span>}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Comments Tab ──────────────────────────────────────────────────────────────

function CommentsTab({ keyId, userId }: { keyId: string; userId: string }) {
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/keys/${keyId}/comments`)
    const d = await r.json() as { data?: CommentRow[] }
    setComments(d.data ?? [])
  }, [keyId])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const submit = async () => {
    if (!message.trim()) return
    setSubmitting(true)
    try {
      const resp = await fetch(`/api/keys/${keyId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      })
      if (!resp.ok) { toast.error('Failed to post comment'); return }
      setMessage('')
      await load()
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    const resp = await fetch(`/api/keys/${keyId}/comments?commentId=${commentId}`, { method: 'DELETE' })
    if (resp.ok) setComments((prev) => prev.filter((c) => c.id !== commentId))
    else toast.error('Failed to delete comment')
  }

  if (loading) {
    return <div className="h-10 rounded bg-zinc-800/50 animate-pulse mt-2" />
  }

  return (
    <div className="flex flex-col gap-2">
      {comments.length === 0 && (
        <p className="text-center py-6 text-zinc-600 text-sm">No comments yet</p>
      )}
      {comments.map((c) => (
        <div key={c.id} className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500">{c.created_at ? timeAgo(c.created_at) : ''}</span>
            {c.user_id === userId && (
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-200 break-words leading-relaxed">{c.message}</p>
        </div>
      ))}
      <div ref={bottomRef} />
      <div className="flex gap-2 pt-1">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }}
          placeholder="Add a comment…"
          className="text-xs bg-zinc-900 border-zinc-700 h-8 flex-1"
        />
        <Button size="sm" onClick={submit} disabled={submitting || !message.trim()} className="h-8 px-2.5">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── Info Tab ──────────────────────────────────────────────────────────────────

interface InfoTabProps {
  keyItem: KeyWithTranslations
  locales: LocaleWithStats[]
  onUpdated: (patch: Partial<KeyWithTranslations>) => void
  onDeleted: () => void
}

function InfoTab({ keyItem, locales, onUpdated, onDeleted }: InfoTabProps) {
  const [approvingLocale, setApprovingLocale] = useState<string | null>(null)

  const approveTranslation = async (localeId: string, value: string) => {
    setApprovingLocale(localeId)
    try {
      const resp = await fetch('/api/translations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId: keyItem.id, localeId, value, status: 'approved' }),
      })
      if (!resp.ok) { toast.error('Failed to approve'); return }
      onUpdated({
        translations: keyItem.translations.map((t) =>
          t.locale_id === localeId ? { ...t, status: 'approved' } : t
        ),
      })
      toast.success('Translation approved')
    } catch {
      toast.error('Network error')
    } finally {
      setApprovingLocale(null)
    }
  }

  const [editingKey, setEditingKey] = useState(false)
  const [keyDraft, setKeyDraft] = useState(keyItem.key)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState(keyItem.description ?? '')
  const [tagInput, setTagInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const patchMeta = async (data: { description?: string; tags?: string[]; platforms?: string[] }) => {
    const resp = await fetch(`/api/keys/${keyItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!resp.ok) { toast.error('Failed to save'); return false }
    onUpdated(data as Partial<KeyWithTranslations>)
    return true
  }

  const saveKey = async () => {
    if (!keyDraft.trim() || keyDraft === keyItem.key) { setEditingKey(false); return }
    if (!/^[a-z0-9_.]+$/.test(keyDraft)) { toast.error('Invalid key format'); return }
    setSavingKey(true)
    const resp = await fetch(`/api/keys/${keyItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyDraft }),
    })
    setSavingKey(false)
    if (!resp.ok) { toast.error('Failed to rename key'); return }
    onUpdated({ key: keyDraft })
    setEditingKey(false)
    toast.success('Key renamed')
  }

  const saveDesc = async () => {
    setSavingDesc(true)
    const ok = await patchMeta({ description: descDraft || '' })
    setSavingDesc(false)
    if (ok) setEditingDesc(false)
  }

  const addTag = async (tag: string) => {
    const t = tag.trim().toLowerCase()
    if (!t) return
    const existing = keyItem.tags ?? []
    if (existing.includes(t)) return
    await patchMeta({ tags: [...existing, t] })
    setTagInput('')
  }

  const removeTag = async (tag: string) => {
    await patchMeta({ tags: (keyItem.tags ?? []).filter((t) => t !== tag) })
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const resp = await fetch(`/api/keys/${keyItem.id}`, { method: 'DELETE' })
      if (!resp.ok) { toast.error('Failed to delete key'); return }
      toast.success(`Key "${keyItem.key}" deleted`)
      onDeleted()
    } catch {
      toast.error('Network error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Key name */}
      <div className="space-y-1.5">
        <div className="text-[11px] text-zinc-500 flex items-center justify-between">
          Key name
          <button
            type="button"
            onClick={() => { setEditingKey(true); setKeyDraft(keyItem.key) }}
            className="text-zinc-600 hover:text-zinc-300"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
        {editingKey ? (
          <div className="flex gap-1.5">
            <Input
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              className="font-mono text-xs bg-zinc-900 border-zinc-700 h-7 flex-1"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') void saveKey(); if (e.key === 'Escape') setEditingKey(false) }}
            />
            <button type="button" onClick={saveKey} disabled={savingKey} className="text-green-400 hover:text-green-300">
              <Check className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setEditingKey(false)} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className="font-mono text-xs text-zinc-200 break-all">{keyItem.key}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 justify-between">
          <span className="flex items-center gap-1"><Info className="h-3 w-3" /> Description</span>
          {!editingDesc && (
            <button type="button" onClick={() => setEditingDesc(true)} className="text-zinc-600 hover:text-zinc-300">
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
        {editingDesc ? (
          <div className="space-y-1.5">
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              rows={2}
              autoFocus
              className="w-full text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex gap-1.5 justify-end">
              <button type="button" onClick={() => setEditingDesc(false)} className="text-[11px] text-zinc-500 hover:text-zinc-300">Cancel</button>
              <button type="button" onClick={saveDesc} disabled={savingDesc} className="text-[11px] text-blue-400 hover:text-blue-300">Save</button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-300 leading-relaxed">
            {keyItem.description || <span className="text-zinc-600 italic">No description</span>}
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <div className="text-[11px] text-zinc-500 flex items-center gap-1">
          <Tag className="h-3 w-3" /> Tags
        </div>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {(keyItem.tags ?? []).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] pr-1 gap-1">
              {tag}
              <button type="button" onClick={() => void removeTag(tag)}>
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addTag(tagInput) } }}
            placeholder="Add tag…"
            className="text-xs h-6 bg-zinc-900 border-zinc-700 flex-1 px-2"
          />
        </div>
      </div>

      {/* Platforms */}
      {(keyItem.platforms ?? []).length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1">
            <Monitor className="h-3 w-3" /> Platforms
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(keyItem.platforms ?? []).map((p) => (
              <span key={p} className="text-[11px] text-zinc-300 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 flex items-center gap-1">
                {p === 'iOS' || p === 'Android' ? <Smartphone className="h-2.5 w-2.5" /> : <Monitor className="h-2.5 w-2.5" />}
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Char limit */}
      {keyItem.char_limit && (
        <div className="text-xs text-zinc-500">
          Char limit: <span className="text-zinc-300">{keyItem.char_limit}</span>
        </div>
      )}

      {/* Translations summary */}
      <div className="space-y-1.5">
        <div className="text-[11px] text-zinc-500">Translations</div>
        <div className="space-y-1">
          {locales.map((locale) => {
            const t = keyItem.translations.find((tr) => tr.locale_id === locale.id)
            const canApprove = !!t?.value && t.status !== 'approved'
            const isApproving = approvingLocale === locale.id
            return (
              <div key={locale.id} className="flex items-start gap-2 group/tr rounded-md hover:bg-zinc-900/60 px-1.5 py-1 -mx-1.5 transition-colors">
                <span className="text-sm mt-0.5">{getFlag(locale.code)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-medium text-zinc-400 uppercase">{locale.code}</span>
                    <StatusBadge status={t?.status as 'empty' | 'pending' | 'reviewed' | 'approved' ?? 'empty'} size="xs" />
                  </div>
                  <p className="text-xs text-zinc-300 truncate">
                    {t?.value ?? <span className="text-zinc-600 italic">No translation</span>}
                  </p>
                </div>
                {canApprove && (
                  <button
                    type="button"
                    disabled={isApproving}
                    onClick={() => void approveTranslation(locale.id, t.value!)}
                    className="opacity-0 group-hover/tr:opacity-100 flex-shrink-0 mt-0.5 flex items-center gap-1 text-[10px] text-emerald-500 hover:text-emerald-400 border border-emerald-800/50 hover:border-emerald-600/50 rounded px-1.5 py-0.5 transition-all disabled:opacity-40"
                    title="Approve this translation"
                  >
                    {isApproving ? (
                      <span className="w-3 h-3 border border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Approve
                  </button>
                )}
                {t?.status === 'approved' && (
                  <span className="flex-shrink-0 mt-0.5 text-[10px] text-emerald-600 flex items-center gap-0.5">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Meta */}
      {keyItem.created_at && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <Clock className="h-3 w-3" />
          Created {new Date(keyItem.created_at).toLocaleDateString()}
        </div>
      )}

      {/* Delete */}
      <div className="pt-2 border-t border-zinc-800">
        {confirmDelete ? (
          <div className="space-y-2">
            <p className="text-xs text-red-400">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs flex-1"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-zinc-700"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-red-900/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3 mr-1.5" />
            Delete Key
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

interface Props {
  keyItem: KeyWithTranslations | undefined
  locales: LocaleWithStats[]
  userId: string
  onClose: () => void
  onKeyUpdated: (patch: Partial<KeyWithTranslations>) => void
  onKeyDeleted: (keyId: string) => void
}

export function KeyDetailPanel({ keyItem, locales, userId, onClose, onKeyUpdated, onKeyDeleted }: Props) {
  const [tab, setTab] = useState<'info' | 'history' | 'comments'>('info')

  return (
    <Dialog open={!!keyItem} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg p-0 bg-zinc-950 border-zinc-800 flex flex-col max-h-[90vh] [&>button]:hidden">
        <DialogHeader className="px-4 py-3 border-b border-zinc-800 flex-shrink-0 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="font-mono text-xs text-zinc-300 truncate">
            {keyItem?.key ?? ''}
          </DialogTitle>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 flex-shrink-0">
          {(['info', 'history', 'comments'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-2 text-xs font-medium capitalize transition-colors',
                tab === t
                  ? 'text-zinc-100 border-b-2 border-blue-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {keyItem && tab === 'info' && (
            <InfoTab
              key={keyItem.id}
              keyItem={keyItem}
              locales={locales}
              onUpdated={(patch) => onKeyUpdated(patch)}
              onDeleted={() => { onClose(); onKeyDeleted(keyItem.id) }}
            />
          )}
          {keyItem && tab === 'history' && <HistoryTab key={keyItem.id} keyId={keyItem.id} />}
          {keyItem && tab === 'comments' && <CommentsTab key={keyItem.id} keyId={keyItem.id} userId={userId} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
