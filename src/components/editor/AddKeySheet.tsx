'use client'

import { useState, useCallback } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import type { KeyWithTranslations } from '@/lib/supabase/queries/translations'
import type { LocaleWithStats } from '@/types'

const PLATFORMS = ['iOS', 'Android', 'Web', 'Desktop'] as const

function getJsonPreview(keyName: string, baseValue: string): string {
  if (!keyName) return '{}'
  const parts = keyName.split('.')
  const result: Record<string, unknown> = {}
  let cursor = result
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!part) continue
    cursor[part] = {}
    cursor = cursor[part] as Record<string, unknown>
  }
  const last = parts[parts.length - 1]
  if (last) cursor[last] = baseValue || '…'
  return JSON.stringify(result, null, 2)
}

interface Props {
  open: boolean
  projectId: string
  locales: LocaleWithStats[]
  existingKeys: string[]
  onClose: () => void
  onCreated: (key: KeyWithTranslations) => void
}

export function AddKeySheet({ open, projectId, locales, existingKeys, onClose, onCreated }: Props) {
  const [keyName, setKeyName] = useState('')
  const [description, setDescription] = useState('')
  const [baseValue, setBaseValue] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [charLimit, setCharLimit] = useState<number | null>(null)
  const [charLimitEnabled, setCharLimitEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const baseLocale = locales.find((l) => l.is_base) ?? locales[0]
  const localeIds = locales.map((l) => l.id)

  const keyError = (() => {
    if (!keyName) return ''
    if (!/^[a-z0-9_.]+$/.test(keyName)) return 'Lowercase letters, numbers, dots, underscores only'
    if (existingKeys.includes(keyName)) return 'Key already exists in this project'
    return ''
  })()

  const togglePlatform = useCallback((p: string) => {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }, [])

  const addTag = useCallback(() => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput('')
  }, [tagInput, tags])

  const reset = () => {
    setKeyName(''); setDescription(''); setBaseValue('')
    setTags([]); setTagInput(''); setPlatforms([])
    setCharLimit(null); setCharLimitEnabled(false); setError('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyName.trim() || keyError) return
    setLoading(true); setError('')
    try {
      const resp = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          key: keyName.trim(),
          description: description.trim() || undefined,
          tags: tags.length ? tags : undefined,
          platforms: platforms.length ? platforms : undefined,
          charLimit: charLimitEnabled ? charLimit : undefined,
          localeIds,
        }),
      })
      const data = await resp.json() as { id?: string; error?: unknown }
      if (!resp.ok) {
        const msg = typeof data.error === 'string' ? data.error : 'Failed to create key'
        setError(msg); return
      }
      // Also save base value if provided
      if (baseValue.trim() && data.id && baseLocale) {
        const t = await fetch('/api/translations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyId: data.id,
            localeId: baseLocale.id,
            value: baseValue.trim(),
            status: 'pending',
          }),
        })
        if (!t.ok) console.warn('Failed to save base value')
      }
      // Fetch the full key with translations
      const keyResp = await fetch(`/api/keys?projectId=${projectId}`)
      const keyData = await keyResp.json() as { data?: KeyWithTranslations[] }
      const newKey = (keyData.data ?? []).find((k) => k.id === data.id)
      if (newKey) onCreated(newKey)
      toast.success(`Key "${keyName}" created`)
      reset(); onClose()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const jsonPreview = getJsonPreview(keyName, baseValue)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-3xl p-0 bg-zinc-950 border-zinc-800 flex flex-col max-h-[90vh] [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b border-zinc-800 flex-shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-zinc-100 text-base">Add Translation Key</DialogTitle>
          <button type="button" onClick={handleClose} className="text-zinc-500 hover:text-zinc-300"><X className="h-4 w-4" /></button>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: form */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
          >
            {/* Key name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Key name *</label>
              <Input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="auth.login.button"
                className="font-mono text-sm bg-zinc-900 border-zinc-700 focus:border-blue-500"
                autoFocus
              />
              {keyError && <p className="text-[11px] text-red-400">{keyError}</p>}
              {!keyError && (
                <p className="text-[11px] text-zinc-600">Lowercase letters, numbers, dots, underscores</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Context for translators…"
                maxLength={500}
                rows={2}
                className="w-full text-sm bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Base value */}
            {baseLocale && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">
                  Base value <span className="text-zinc-600">({baseLocale.code.toUpperCase()})</span>
                </label>
                <Input
                  value={baseValue}
                  onChange={(e) => setBaseValue(e.target.value)}
                  placeholder={`Enter ${baseLocale.name} translation…`}
                  className="text-sm bg-zinc-900 border-zinc-700 focus:border-blue-500"
                />
              </div>
            )}

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Tags</label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="Add tag…"
                  className="text-sm bg-zinc-900 border-zinc-700 h-8"
                />
                <Button type="button" size="sm" variant="outline" className="border-zinc-700 h-8 px-2" onClick={addTag}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[11px] pr-1 gap-1">
                      {tag}
                      <button type="button" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Platforms */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Platforms</label>
              <div className="flex gap-2 flex-wrap">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={[
                      'text-xs px-2.5 py-1 rounded border transition-colors',
                      platforms.includes(p)
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500',
                    ].join(' ')}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Char limit */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-zinc-400">Character limit</label>
                <button
                  type="button"
                  onClick={() => setCharLimitEnabled((v) => !v)}
                  className={[
                    'w-8 h-4 rounded-full transition-colors relative',
                    charLimitEnabled ? 'bg-blue-600' : 'bg-zinc-700',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all',
                      charLimitEnabled ? 'left-4.5' : 'left-0.5',
                    ].join(' ')}
                  />
                </button>
              </div>
              {charLimitEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Slider
                      min={1}
                      max={500}
                      step={1}
                      value={[charLimit ?? 100]}
                      onValueChange={([v]) => setCharLimit(v ?? 100)}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCharLimit((v) => Math.max(1, (v ?? 100) - 1))}
                        className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <Input
                        type="number"
                        value={charLimit ?? 100}
                        onChange={(e) => setCharLimit(Number(e.target.value))}
                        className="w-16 text-center text-sm bg-zinc-900 border-zinc-700 h-7 px-1"
                        min={1}
                        max={9999}
                      />
                      <button
                        type="button"
                        onClick={() => setCharLimit((v) => (v ?? 100) + 1)}
                        className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 pb-6">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} className="border-zinc-700">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading || !keyName.trim() || !!keyError}>
                {loading ? 'Creating…' : 'Create Key'}
              </Button>
            </div>
          </form>

          {/* Right: preview */}
          <div className="w-52 flex-shrink-0 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto p-4 space-y-4">
            <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Preview</div>

            {/* Summary card */}
            <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3 space-y-1.5">
              {keyName ? (
                <p className="font-mono text-[11px] text-blue-300 break-all">{keyName}</p>
              ) : (
                <p className="text-[11px] text-zinc-600 italic">Enter a key name…</p>
              )}
              {description && (
                <p className="text-[11px] text-zinc-400 leading-relaxed">{description}</p>
              )}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <span key={t} className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 rounded">{t}</span>
                  ))}
                </div>
              )}
              {platforms.length > 0 && (
                <p className="text-[10px] text-zinc-500">{platforms.join(' · ')}</p>
              )}
              {charLimitEnabled && charLimit && (
                <p className="text-[10px] text-zinc-500">Max {charLimit} chars</p>
              )}
            </div>

            {/* JSON preview */}
            <div>
              <div className="text-[11px] font-medium text-zinc-500 mb-1.5">JSON output</div>
              <pre className="text-[10px] font-mono text-zinc-300 bg-zinc-950 rounded border border-zinc-800 p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {jsonPreview}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
