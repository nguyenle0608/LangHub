'use client'

import { useEffect, useRef, useState } from 'react'
import { BookOpen, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database'

type GlossaryRow = Database['public']['Tables']['glossary_terms']['Row']
type ImportResult = { totalRows: number; created: number; skipped: number; errors: string[] }

export function GlossaryPanel({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const [terms, setTerms] = useState<GlossaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sourceLocale, setSourceLocale] = useState('en')
  const [targetLocale, setTargetLocale] = useState('vi')
  const [sourceTerm, setSourceTerm] = useState('')
  const [targetTerm, setTargetTerm] = useState('')
  const [description, setDescription] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(true)
  const [filterSource, setFilterSource] = useState('')
  const [filterTarget, setFilterTarget] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/organizations/${orgId}/glossary?limit=50&offset=0`, { cache: 'no-store' })
      .then(async (response) => ({ response, json: await response.json() as { data?: GlossaryRow[]; pagination?: { nextOffset: number | null } } }))
      .then(({ response, json }) => { if (response.ok) { setTerms(json.data ?? []); setNextOffset(json.pagination?.nextOffset ?? null) } })
      .catch(() => toast.error('Failed to load glossary'))
      .finally(() => setLoading(false))
  }, [orgId])

  async function loadMore() {
    if (nextOffset == null) return
    setLoading(true)
    try {
      const filters = new URLSearchParams({ limit: '50', offset: String(nextOffset) })
      if (filterSource.trim()) filters.set('sourceLocale', filterSource.trim())
      if (filterTarget.trim()) filters.set('targetLocale', filterTarget.trim())
      const response = await fetch(`/api/organizations/${orgId}/glossary?${filters}`, { cache: 'no-store' })
      const json = await response.json() as { data?: GlossaryRow[]; pagination?: { nextOffset: number | null } }
      if (!response.ok) throw new Error('Failed')
      setTerms((current) => [...current, ...(json.data ?? [])])
      setNextOffset(json.pagination?.nextOffset ?? null)
    } catch { toast.error('Failed to load more glossary terms') }
    finally { setLoading(false) }
  }

  async function applyFilters() {
    setLoading(true)
    const filters = new URLSearchParams({ limit: '50', offset: '0' })
    if (filterSource.trim()) filters.set('sourceLocale', filterSource.trim())
    if (filterTarget.trim()) filters.set('targetLocale', filterTarget.trim())
    try {
      const response = await fetch(`/api/organizations/${orgId}/glossary?${filters}`, { cache: 'no-store' })
      const json = await response.json() as { data?: GlossaryRow[]; pagination?: { nextOffset: number | null } }
      if (!response.ok) throw new Error('Failed')
      setTerms(json.data ?? []); setNextOffset(json.pagination?.nextOffset ?? null)
    } catch { toast.error('Failed to filter glossary terms') }
    finally { setLoading(false) }
  }

  async function importCSV(file: File) {
    setImporting(true)
    setImportResult(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch(`/api/organizations/${orgId}/glossary/import`, { method: 'POST', body })
      const json = await response.json() as { data?: ImportResult; error?: string }
      if (!response.ok || !json.data) {
        toast.error(typeof json.error === 'string' ? json.error : 'Failed to import glossary terms')
        return
      }
      setImportResult(json.data)
      if (json.data.created > 0) {
        toast.success(`Imported ${json.data.created} glossary term${json.data.created === 1 ? '' : 's'}`)
        await applyFilters()
      } else {
        toast.info('No new glossary terms were imported')
      }
    } catch { toast.error('Network error') }
    finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function saveTerm(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const response = await fetch(editingId ? `/api/organizations/${orgId}/glossary/${editingId}` : `/api/organizations/${orgId}/glossary`, {
      method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceLocale, targetLocale, sourceTerm, targetTerm, caseSensitive, wholeWord, description: description.trim() || null }),
    })
    const json = await response.json() as { data?: GlossaryRow; error?: string }
    if (response.ok && json.data) {
      setTerms((current) => (editingId ? current.map((term) => term.id === editingId ? json.data! : term) : [...current, json.data!]).sort((a, b) => a.source_term.localeCompare(b.source_term)))
      setSourceTerm(''); setTargetTerm(''); setDescription(''); setEditingId(null); toast.success(editingId ? 'Glossary term updated' : 'Glossary term created')
    } else toast.error(typeof json.error === 'string' ? json.error : 'Failed to save glossary term')
    setSaving(false)
  }

  function editTerm(term: GlossaryRow) {
    setEditingId(term.id); setSourceLocale(term.source_locale); setTargetLocale(term.target_locale)
    setSourceTerm(term.source_term); setTargetTerm(term.target_term)
    setDescription(term.description ?? '')
    setCaseSensitive(term.case_sensitive); setWholeWord(term.whole_word)
  }

  function cancelEdit() { setEditingId(null); setSourceTerm(''); setTargetTerm(''); setDescription('') }

  async function removeTerm(termId: string) {
    if (confirmDelete !== termId) { setConfirmDelete(termId); return }
    const response = await fetch(`/api/organizations/${orgId}/glossary/${termId}`, { method: 'DELETE' })
    if (response.ok) { setTerms((current) => current.filter((term) => term.id !== termId)); toast.success('Glossary term deleted') }
    else toast.error('Failed to delete glossary term')
    setConfirmDelete(null)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-6 py-4">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <div><h2 className="text-base font-semibold">Glossary</h2><p className="text-xs text-muted-foreground">Keep product terminology consistent across workspace projects.</p></div>
      </div>
      {canManage && (
        <form onSubmit={saveTerm} className="space-y-3 border-b border-border px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="glossary-source">Source term</Label><Input id="glossary-source" value={sourceTerm} onChange={(event) => setSourceTerm(event.target.value)} maxLength={500} required /></div>
            <div className="space-y-1.5"><Label htmlFor="glossary-target">Required translation</Label><Input id="glossary-target" value={targetTerm} onChange={(event) => setTargetTerm(event.target.value)} maxLength={500} required /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="glossary-description">Description (optional)</Label><Input id="glossary-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Context for translators" /></div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5"><Label htmlFor="glossary-source-locale">Source locale</Label><Input id="glossary-source-locale" value={sourceLocale} onChange={(event) => setSourceLocale(event.target.value)} className="w-24" required /></div>
            <div className="space-y-1.5"><Label htmlFor="glossary-target-locale">Target locale</Label><Input id="glossary-target-locale" value={targetLocale} onChange={(event) => setTargetLocale(event.target.value)} className="w-24" required /></div>
            <label className="flex h-10 items-center gap-2 text-xs"><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} /> Case sensitive</label>
            <label className="flex h-10 items-center gap-2 text-xs"><input type="checkbox" checked={wholeWord} onChange={(event) => setWholeWord(event.target.checked)} /> Whole word</label>
            {editingId && <Button type="button" variant="ghost" onClick={cancelEdit} className="ml-auto gap-1"><X className="h-4 w-4" />Cancel</Button>}
            <Button type="submit" disabled={saving || !sourceTerm.trim() || !targetTerm.trim()} className={editingId ? 'gap-1.5 bg-blue-600 text-white hover:bg-blue-500' : 'ml-auto gap-1.5 bg-blue-600 text-white hover:bg-blue-500'}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editingId ? 'Save changes' : 'Add term'}</Button>
          </div>
        </form>
      )}
      {canManage && (
        <div className="space-y-2.5 border-b border-border px-6 py-5">
          <div>
            <p className="text-sm font-medium">Bulk import (CSV)</p>
            <p className="text-xs text-muted-foreground">
              Columns: <code className="rounded bg-muted px-1">source_locale,target_locale,source_term,target_term,case_sensitive,whole_word</code>. The last two are optional (default false/true).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="Glossary CSV file"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importCSV(file)
              }}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? 'Importing…' : 'Choose CSV file'}
            </Button>
          </div>
          {importResult && (
            <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
              <p className="flex items-center gap-1.5 font-medium"><Upload className="h-3.5 w-3.5" /> {importResult.created} imported · {importResult.skipped} skipped (already exist) · {importResult.totalRows} rows read</p>
              {importResult.errors.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                  {importResult.errors.slice(0, 10).map((message) => <li key={message}>{message}</li>)}
                  {importResult.errors.length > 10 && <li>+{importResult.errors.length - 10} more</li>}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2 border-b border-border px-6 py-3">
        <div className="space-y-1"><Label htmlFor="glossary-filter-source" className="text-xs">Source locale</Label><Input id="glossary-filter-source" value={filterSource} onChange={(event) => setFilterSource(event.target.value)} placeholder="All" className="h-8 w-24" /></div>
        <div className="space-y-1"><Label htmlFor="glossary-filter-target" className="text-xs">Target locale</Label><Input id="glossary-filter-target" value={filterTarget} onChange={(event) => setFilterTarget(event.target.value)} placeholder="All" className="h-8 w-24" /></div>
        <Button type="button" variant="outline" size="sm" onClick={() => void applyFilters()}>Filter</Button>
      </div>
      <div className="divide-y divide-border">
        {loading ? <div className="flex justify-center px-6 py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : terms.length === 0 ? <p className="px-6 py-8 text-center text-sm text-muted-foreground">No glossary terms yet.</p>
          : terms.map((term) => (
            <div key={term.id} className="flex items-center gap-3 px-6 py-3">
              <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{term.source_locale} → {term.target_locale}</span>
              <div className="min-w-0 flex-1 text-sm"><span className="font-medium">{term.source_term}</span><span className="mx-2 text-muted-foreground">→</span><span>{term.target_term}</span></div>
              {canManage && <Button type="button" variant="ghost" size="sm" onClick={() => editTerm(term)}><Pencil className="h-4 w-4" /><span className="sr-only">Edit {term.source_term}</span></Button>}
              {canManage && <Button type="button" variant={confirmDelete === term.id ? 'destructive' : 'ghost'} size="sm" onClick={() => void removeTerm(term.id)} className="gap-1"><Trash2 className="h-4 w-4" />{confirmDelete === term.id ? 'Confirm' : <span className="sr-only">Delete {term.source_term}</span>}</Button>}
            </div>
          ))}
      </div>
      {nextOffset != null && <div className="border-t border-border px-6 py-3 text-center"><Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void loadMore()}>Load more</Button></div>}
    </section>
  )
}
