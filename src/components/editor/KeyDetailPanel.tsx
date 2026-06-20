'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Info, Tag, Clock, Send, Trash2, Pencil, Check, Monitor, Smartphone, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/utils'
import type { KeyWithTranslations } from '@/lib/supabase/queries/translations'
import type { LocaleWithStats } from '@/types'
import { localeFlag } from '@/lib/locale-flag'
import type { Database } from '@/types/database'

type HistoryRow = Database['public']['Tables']['translation_history']['Row'] & {
  locale: { code: string; name: string }
}
type CommentRow = Database['public']['Tables']['comments']['Row']

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon: Icon, collapsible, defaultOpen = true, children }: {
  title: string
  icon?: React.ElementType
  collapsible?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-zinc-800/60 last:border-0">
      <button
        type="button"
        className={cn(
          'w-full flex items-center gap-1.5 px-4 py-2.5 text-left',
          collapsible && 'hover:bg-zinc-800/30 transition-colors'
        )}
        onClick={() => collapsible && setOpen((v) => !v)}
        disabled={!collapsible}
      >
        {Icon && <Icon className="h-3 w-3 text-zinc-500 flex-shrink-0" />}
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex-1">{title}</span>
        {collapsible && (
          <ChevronDown className={cn('h-3 w-3 text-zinc-600 transition-transform', !open && '-rotate-90')} />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ── Left: Translations ────────────────────────────────────────────────────────

function TranslationsPane({
  keyItem,
  locales,
  branchId,
  onUpdated,
  canEdit,
  canManage,
}: {
  keyItem: KeyWithTranslations
  locales: LocaleWithStats[]
  branchId: string
  onUpdated: (patch: Partial<KeyWithTranslations>) => void
  canEdit: boolean
  canManage: boolean
}) {
  const [drafts, setDrafts] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>()
    for (const locale of locales) {
      const t = keyItem.translations.find((tr) => tr.locale_id === locale.id)
      m.set(locale.id, t?.value ?? '')
    }
    return m
  })
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [approving, setApproving] = useState<Set<string>>(new Set())
  const [reviewing, setReviewing] = useState<Set<string>>(new Set())

  useEffect(() => {
    setDrafts(() => {
      const m = new Map<string, string>()
      for (const locale of locales) {
        const t = keyItem.translations.find((tr) => tr.locale_id === locale.id)
        m.set(locale.id, t?.value ?? '')
      }
      return m
    })
  }, [keyItem.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTranslation = async (localeId: string) => {
    const value = drafts.get(localeId) ?? ''
    const existing = keyItem.translations.find((t) => t.locale_id === localeId)
    if (value === (existing?.value ?? '')) return
    setSaving((p) => new Set(p).add(localeId))
    const status = value.trim() ? 'pending' : 'empty'
    try {
      const resp = await fetch('/api/translations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, keyId: keyItem.id, localeId, value, status }),
      })
      if (!resp.ok) { toast.error('Failed to save'); return }
      const result = await resp.json() as { id?: string }
      if (existing) {
        onUpdated({ translations: keyItem.translations.map((t) => t.locale_id === localeId ? { ...t, value, status } : t) })
      } else {
        // New row — append to translations
        onUpdated({
          translations: [
            ...keyItem.translations,
            {
              id: result.id ?? `optimistic-${localeId}`,
              branch_id: branchId,
              key_id: keyItem.id, locale_id: localeId, value, status,
              updated_at: new Date().toISOString(),
              translated_by: null, reviewed_by: null,
              ai_model: null, ai_suggested_at: null, ai_suggestion: null,
            },
          ],
        })
      }
    } catch { toast.error('Network error') }
    finally { setSaving((p) => { const n = new Set(p); n.delete(localeId); return n }) }
  }

  const approve = async (localeId: string) => {
    const value = drafts.get(localeId) ?? ''
    if (!value.trim()) return
    const existing = keyItem.translations.find((t) => t.locale_id === localeId)
    if (value !== (existing?.value ?? '')) await saveTranslation(localeId)
    setApproving((p) => new Set(p).add(localeId))
    try {
      const resp = await fetch('/api/translations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, keyId: keyItem.id, localeId, value, status: 'approved' }),
      })
      if (!resp.ok) { toast.error('Failed to approve'); return }
      onUpdated({ translations: keyItem.translations.map((t) => t.locale_id === localeId ? { ...t, value, status: 'approved' } : t) })
      toast.success('Approved')
    } catch { toast.error('Network error') }
    finally { setApproving((p) => { const n = new Set(p); n.delete(localeId); return n }) }
  }

  const markReviewed = async (localeId: string) => {
    const value = drafts.get(localeId) ?? ''
    if (!value.trim()) return
    const existing = keyItem.translations.find((t) => t.locale_id === localeId)
    if (value !== (existing?.value ?? '')) await saveTranslation(localeId)
    setReviewing((p) => new Set(p).add(localeId))
    try {
      const resp = await fetch('/api/translations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, keyId: keyItem.id, localeId, value, status: 'reviewed' }),
      })
      if (!resp.ok) { toast.error('Failed to mark as reviewed'); return }
      onUpdated({ translations: keyItem.translations.map((t) => t.locale_id === localeId ? { ...t, value, status: 'reviewed' } : t) })
    } catch { toast.error('Network error') }
    finally { setReviewing((p) => { const n = new Set(p); n.delete(localeId); return n }) }
  }

  const orderedLocales = [...locales.filter((l) => l.is_base), ...locales.filter((l) => !l.is_base)]

  return (
    <div className="space-y-3 py-1">
      {orderedLocales.map((locale) => {
        const t = keyItem.translations.find((tr) => tr.locale_id === locale.id)
        const draft = drafts.get(locale.id) ?? ''
        const isDirty = draft !== (t?.value ?? '')
        const isSaving = saving.has(locale.id)
        const isApproving = approving.has(locale.id)
        const isReviewing = reviewing.has(locale.id)
        const canReview = canEdit && !!draft.trim() && t?.status !== 'reviewed' && t?.status !== 'approved'
        const canApprove = canEdit && !!draft.trim() && t?.status !== 'approved'
        const charLimit = keyItem.char_limit
        const overLimit = charLimit !== null && draft.length > charLimit

        return (
          <div
            key={locale.id}
            className={cn(
              'rounded-lg border overflow-hidden transition-colors',
              isDirty ? 'border-blue-500/50 bg-blue-950/10' : 'border-zinc-800 bg-zinc-900/40'
            )}
          >
            {/* header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60">
              <span className="text-base leading-none">{localeFlag(locale.code)}</span>
              <span className="text-xs font-medium text-zinc-300">{locale.name}</span>
              {locale.is_base && <span className="text-[9px] text-zinc-600 border border-zinc-700 rounded px-1">base</span>}
              <div className="ml-auto flex items-center gap-2">
                <StatusBadge
                  status={(isDirty ? 'pending' : (t?.status ?? 'empty')) as 'empty' | 'pending' | 'reviewed' | 'approved'}
                  size="xs"
                />
                {charLimit !== null && (
                  <span className={cn('text-[10px] tabular-nums', overLimit ? 'text-red-400' : 'text-zinc-600')}>
                    {draft.length}/{charLimit}
                  </span>
                )}
              </div>
            </div>

            {/* textarea */}
            <textarea
              value={draft}
              onChange={(e) => canEdit && setDrafts((p) => new Map(p).set(locale.id, e.target.value))}
              onBlur={() => canEdit && void saveTranslation(locale.id)}
              rows={3}
              placeholder={locale.is_base ? 'Source text…' : 'Translation…'}
              readOnly={!canEdit}
              className={cn(
                'w-full bg-transparent text-sm text-zinc-100 px-3 py-2.5 resize-none focus:outline-none placeholder:text-zinc-600 leading-relaxed',
                !canEdit && 'cursor-default select-text'
              )}
            />

            {/* footer */}
            {(isDirty || canReview || canApprove) && (
              <div className="flex items-center justify-end px-3 py-1.5 border-t border-zinc-800/60 bg-zinc-950/30">
                <div className="flex gap-1.5">
                  {isDirty && canEdit && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-zinc-400 hover:text-zinc-200" onClick={() => void saveTranslation(locale.id)} disabled={isSaving}>
                      Save
                    </Button>
                  )}
                  {canReview && !isDirty && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-blue-950/40" onClick={() => void markReviewed(locale.id)} disabled={isReviewing || isSaving}>
                      {isReviewing
                        ? <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                        : 'Review'}
                    </Button>
                  )}
                  {canApprove && (
                    <Button size="sm" className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => void approve(locale.id)} disabled={isApproving || isSaving}>
                      {isApproving
                        ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />
                        : <><Check className="h-3 w-3 mr-1" />Approve</>
                      }
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Right: Details ────────────────────────────────────────────────────────────

function DetailsPane({
  keyItem,
  locales,
  userId,
  onUpdated,
  onDeleted,
  canEditKeys,
}: {
  keyItem: KeyWithTranslations
  locales: LocaleWithStats[]
  userId: string
  onUpdated: (patch: Partial<KeyWithTranslations>) => void
  onDeleted: () => void
  canEditKeys: boolean
}) {
  // key meta state
  const [editingKey, setEditingKey] = useState(false)
  const [keyDraft, setKeyDraft] = useState(keyItem.key)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState(keyItem.description ?? '')
  const [tagInput, setTagInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // comments state
  const [comments, setComments] = useState<CommentRow[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // history state
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const loadComments = useCallback(async () => {
    const r = await fetch(`/api/keys/${keyItem.id}/comments`)
    const d = await r.json() as { data?: CommentRow[] }
    setComments(d.data ?? [])
  }, [keyItem.id])

  useEffect(() => {
    setCommentsLoading(true)
    loadComments().finally(() => setCommentsLoading(false))
  }, [loadComments])

  useEffect(() => {
    if (!historyOpen || history.length > 0) return
    setHistoryLoading(true)
    fetch(`/api/keys/${keyItem.id}/history`)
      .then((r) => r.json())
      .then((d: { data?: HistoryRow[] }) => setHistory(d.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [historyOpen, keyItem.id, history.length])

  const patchMeta = async (data: object) => {
    const resp = await fetch(`/api/keys/${keyItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!resp.ok) { toast.error('Failed to save'); return false }
    onUpdated(data as Partial<KeyWithTranslations>)
    return true
  }

  const saveKey = async () => {
    if (!keyDraft.trim() || keyDraft === keyItem.key) { setEditingKey(false); return }
    if (!/^[a-z0-9_.]+$/.test(keyDraft)) { toast.error('Invalid key format'); return }
    setSavingKey(true)
    const resp = await fetch(`/api/keys/${keyItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: keyDraft }) })
    setSavingKey(false)
    if (!resp.ok) { toast.error('Failed to rename'); return }
    onUpdated({ key: keyDraft }); setEditingKey(false); toast.success('Key renamed')
  }

  const saveDesc = async () => {
    setSavingDesc(true)
    const ok = await patchMeta({ description: descDraft || '' })
    setSavingDesc(false)
    if (ok) setEditingDesc(false)
  }

  const submitComment = async () => {
    if (!message.trim()) return
    setSubmitting(true)
    try {
      const resp = await fetch(`/api/keys/${keyItem.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message.trim() }) })
      if (!resp.ok) { toast.error('Failed to post'); return }
      setMessage('')
      await loadComments()
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch { toast.error('Network error') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const resp = await fetch(`/api/keys/${keyItem.id}`, { method: 'DELETE' })
      if (!resp.ok) { toast.error('Failed to delete'); return }
      toast.success(`"${keyItem.key}" deleted`)
      onDeleted()
    } catch { toast.error('Network error') }
    finally { setDeleting(false) }
  }

  return (
    <div className="divide-y divide-zinc-800/60">
      {/* Key metadata */}
      <Section title="Key" icon={Info}>
        <div className="space-y-3 text-xs">
          {/* Key name */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1">
              <span>Name</span>
              {canEditKeys && <button onClick={() => { setEditingKey(true); setKeyDraft(keyItem.key) }} className="hover:text-zinc-300"><Pencil className="h-2.5 w-2.5" /></button>}
            </div>
            {editingKey ? (
              <div className="flex gap-1">
                <Input value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} className="font-mono text-xs bg-zinc-950 border-zinc-700 h-6 flex-1 px-2" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') void saveKey(); if (e.key === 'Escape') setEditingKey(false) }} />
                <button onClick={saveKey} disabled={savingKey} className="text-green-400"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditingKey(false)} className="text-zinc-500"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <p className="font-mono text-zinc-200 break-all leading-relaxed">{keyItem.key}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1">
              <span>Description</span>
              {canEditKeys && !editingDesc && <button onClick={() => setEditingDesc(true)} className="hover:text-zinc-300"><Pencil className="h-2.5 w-2.5" /></button>}
            </div>
            {editingDesc ? (
              <div className="space-y-1.5">
                <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={2} autoFocus className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-blue-500 resize-none text-xs" />
                <div className="flex gap-2 justify-end text-[10px]">
                  <button onClick={() => setEditingDesc(false)} className="text-zinc-500 hover:text-zinc-300">Cancel</button>
                  <button onClick={saveDesc} disabled={savingDesc} className="text-blue-400 hover:text-blue-300">Save</button>
                </div>
              </div>
            ) : (
              <p className="text-zinc-400 leading-relaxed">{keyItem.description || <span className="text-zinc-600 italic">—</span>}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-600 mb-1.5"><Tag className="h-2.5 w-2.5" /> Tags</div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {(keyItem.tags ?? []).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] pr-1 gap-1">
                  {tag}
                  {canEditKeys && <button onClick={() => void patchMeta({ tags: (keyItem.tags ?? []).filter((t) => t !== tag) })}><X className="h-2 w-2" /></button>}
                </Badge>
              ))}
            </div>
            {canEditKeys && <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const t = tagInput.trim().toLowerCase(); if (t && !(keyItem.tags ?? []).includes(t)) { void patchMeta({ tags: [...(keyItem.tags ?? []), t] }); setTagInput('') } } }} placeholder="Add tag…" className="text-[11px] h-6 bg-zinc-950 border-zinc-700 px-2" />}
          </div>

          {/* Misc */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-600">
            {keyItem.char_limit && <span>Char limit: <span className="text-zinc-400">{keyItem.char_limit}</span></span>}
            {(keyItem.platforms ?? []).length > 0 && (
              <span className="flex items-center gap-1">
                {(keyItem.platforms ?? []).map((p) => (
                  <span key={p} className="flex items-center gap-0.5">
                    {p === 'iOS' || p === 'Android' ? <Smartphone className="h-2.5 w-2.5" /> : <Monitor className="h-2.5 w-2.5" />}
                    {p}
                  </span>
                ))}
              </span>
            )}
            {keyItem.created_at && (
              <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{new Date(keyItem.created_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </Section>

      {/* Comments */}
      <Section title="Comments" icon={Send}>
        {commentsLoading ? (
          <div className="h-8 rounded bg-zinc-800/50 animate-pulse" />
        ) : (
          <div className="space-y-2">
            {comments.length === 0 && <p className="text-[11px] text-zinc-600 text-center py-2">No comments yet</p>}
            {comments.map((c) => (
              <div key={c.id} className="rounded border border-zinc-800 bg-zinc-900/50 px-2.5 py-2 group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-zinc-600">{c.created_at ? timeAgo(c.created_at) : ''}</span>
                  {c.user_id === userId && (
                    <button onClick={async () => { const r = await fetch(`/api/keys/${keyItem.id}/comments?commentId=${c.id}`, { method: 'DELETE' }); if (r.ok) setComments((p) => p.filter((x) => x.id !== c.id)) }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400">
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed break-words">{c.message}</p>
              </div>
            ))}
            <div ref={bottomRef} />
            <div className="flex gap-1.5 pt-1">
              <Input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitComment() } }} placeholder="Add a comment…" className="text-xs bg-zinc-950 border-zinc-700 h-7 flex-1" />
              <Button size="sm" onClick={submitComment} disabled={submitting || !message.trim()} className="h-7 px-2">
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </Section>

      {/* History */}
      <div className="border-b border-zinc-800/60 last:border-0">
        <button
          type="button"
          className="w-full flex items-center gap-1.5 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors text-left"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <Clock className="h-3 w-3 text-zinc-500" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex-1">History</span>
          <ChevronDown className={cn('h-3 w-3 text-zinc-600 transition-transform', !historyOpen && '-rotate-90')} />
        </button>
        {historyOpen && (
          <div className="px-4 pb-4 space-y-2">
            {historyLoading
              ? [1, 2].map((i) => <div key={i} className="h-12 rounded bg-zinc-800/50 animate-pulse" />)
              : history.length === 0
              ? <p className="text-[11px] text-zinc-600 text-center py-2">No history</p>
              : history.map((h) => (
                <div key={h.id} className="rounded border border-zinc-800 bg-zinc-900/50 px-2.5 py-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm leading-none">{localeFlag(h.locale.code)}</span>
                    <span className="text-[10px] font-medium text-zinc-500 uppercase">{h.locale.code}</span>
                    {h.new_status && <StatusBadge status={h.new_status as 'empty' | 'pending' | 'reviewed' | 'approved'} size="xs" />}
                    <span className="ml-auto text-[10px] text-zinc-600">{h.changed_at ? timeAgo(h.changed_at) : ''}</span>
                  </div>
                  {h.old_value !== null && (
                    <p className="text-[10px] text-zinc-600 line-through break-words">{h.old_value || <span className="italic">empty</span>}</p>
                  )}
                  <p className="text-[11px] text-zinc-300 break-words whitespace-pre-wrap">{h.new_value || <span className="text-zinc-600 italic">empty</span>}</p>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Delete — owner only */}
      {canEditKeys && (
        <div className="px-4 py-3">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-red-400">Delete this key and all its translations?</p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" className="h-7 text-xs flex-1" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Confirm Delete'}</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-700" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-500 text-white w-full" onClick={handleDelete}>
              <Trash2 className="h-3 w-3 mr-1.5" />Delete Key
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

interface Props {
  keyItem: KeyWithTranslations | undefined
  locales: LocaleWithStats[]
  userId: string
  branchId: string
  canEdit: boolean
  canManage: boolean
  canEditKeys: boolean
  onClose: () => void
  onKeyUpdated: (patch: Partial<KeyWithTranslations>) => void
  onKeyDeleted: (keyId: string) => void
}

export function KeyDetailPanel({ keyItem, locales, userId, branchId, canEdit, canManage, canEditKeys, onClose, onKeyUpdated, onKeyDeleted }: Props) {
  return (
    <Dialog open={!!keyItem} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-4xl p-0 bg-zinc-950 border-zinc-800 flex flex-col max-h-[88vh] [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-zinc-800 flex-shrink-0 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="font-mono text-sm text-zinc-200 truncate max-w-lg">
            {keyItem?.key ?? ''}
          </DialogTitle>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 flex-shrink-0 ml-2">
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Two-column body */}
        {keyItem && (
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Left: translations */}
            <div className="flex-1 overflow-y-auto border-r border-zinc-800 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Translations</p>
              <TranslationsPane
                key={keyItem.id}
                keyItem={keyItem}
                locales={locales}
                branchId={branchId}
                onUpdated={onKeyUpdated}
                canEdit={canEdit}
                canManage={canManage}
              />
            </div>

            {/* Right: details */}
            <div className="w-72 flex-shrink-0 overflow-y-auto">
              <DetailsPane
                key={keyItem.id}
                keyItem={keyItem}
                locales={locales}
                userId={userId}
                canEditKeys={canEditKeys}
                onUpdated={onKeyUpdated}
                onDeleted={() => { onClose(); onKeyDeleted(keyItem.id) }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
