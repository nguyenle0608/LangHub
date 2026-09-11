'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ApiTokenMetadata } from '@/lib/api-tokens/management'

type ExpirationChoice = '30' | '90' | '365' | 'never'


/**
 * One row per token, not per secret.
 *
 * Rotation necessarily writes two rows — during the grace period both secrets
 * have to authenticate, so both need their own hash. But a reader thinks in
 * terms of "the CI token", and showing them the bookkeeping means the list
 * grows by one dead entry per rotation and offers a Revoke button whose target
 * ("the old one? the one I just made?") nobody can tell from looking.
 *
 * So a token that has been replaced is folded into its replacement: the row is
 * the identity, and the outgoing secret appears on it as a deadline.
 */
export function collapseRotations(tokens: ApiTokenMetadata[], now: number) {
  const byId = new Map(tokens.map((token) => [token.id, token]))
  const predecessorOf = new Map<string, ApiTokenMetadata>()
  for (const token of tokens) {
    if (token.replacedBy && byId.has(token.replacedBy)) predecessorOf.set(token.replacedBy, token)
  }
  return tokens
    // A replaced row is never its own entry — including after its grace ends,
    // when it is simply history. The chain stays in the database for audit.
    .filter((token) => !(token.replacedBy && byId.has(token.replacedBy)))
    .map((token) => {
      const previous = predecessorOf.get(token.id)
      const stillValid = previous
        && !previous.revokedAt
        && Boolean(previous.expiresAt)
        && new Date(previous.expiresAt!).getTime() > now
      return { token, previous: stillValid ? previous! : null }
    })
}

export function ApiTokensPanel({ orgId }: { orgId: string }) {
  const [tokens, setTokens] = useState<ApiTokenMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [scope, setScope] = useState<'read' | 'write'>('read')
  const [expiration, setExpiration] = useState<ExpirationChoice>('90')
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function loadTokens() {
      const response = await fetch(`/api/organizations/${orgId}/tokens`, { cache: 'no-store' })
      const json = await response.json() as { data?: ApiTokenMetadata[] }
      if (response.ok && json.data) setTokens(json.data)
      else toast.error('Failed to load API tokens')
      setLoading(false)
    }
    void loadTokens()
  }, [orgId])

  async function createToken(event: React.FormEvent) {
    event.preventDefault()
    setCreating(true)
    const expiresAt = expiration === 'never'
      ? null
      : new Date(Date.now() + Number(expiration) * 24 * 60 * 60 * 1000).toISOString()
    const response = await fetch(`/api/organizations/${orgId}/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scope, expiresAt }),
    })
    const json = await response.json() as { data?: { token: string; metadata: ApiTokenMetadata }; error?: string }
    if (response.ok && json.data) {
      setTokens((current) => [json.data!.metadata, ...current])
      setSecret(json.data.token)
      setName('')
      setCopied(false)
      toast.success('API token created')
    } else {
      toast.error(typeof json.error === 'string' ? json.error : 'Failed to create API token')
    }
    setCreating(false)
  }

  async function revokeToken(tokenId: string) {
    const response = await fetch(`/api/organizations/${orgId}/tokens/${tokenId}`, { method: 'DELETE' })
    if (response.ok) {
      const revokedAt = new Date().toISOString()
      setTokens((current) => current.map((token) => token.id === tokenId ? { ...token, revokedAt } : token))
      toast.success('API token revoked')
    } else toast.error('Failed to revoke API token')
  }

  /**
   * Replace a token's secret, keeping its name and scope.
   *
   * The grace period is offered rather than assumed: rotating a leaked token
   * wants the old secret dead now, while rotating a healthy one on schedule
   * wants an overlap so deployments do not fail while configuration catches up.
   * Only the caller knows which of the two this is.
   */
  async function rotateToken(token: ApiTokenMetadata, graceMinutes: number) {
    const response = await fetch(`/api/organizations/${orgId}/tokens/${token.id}/rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graceMinutes }),
    })
    const json = await response.json() as { data?: { token: string; metadata: ApiTokenMetadata }; error?: string }
    if (!response.ok || !json.data) {
      toast.error(json.error ?? 'Failed to rotate API token')
      return
    }
    setSecret(json.data.token)
    setCopied(false)
    // Refetch rather than patch: rotation changes the old row too — when it
    // retires, and what replaced it — and guessing that here is how a list
    // starts disagreeing with the database.
    const listed = await fetch(`/api/organizations/${orgId}/tokens`, { cache: 'no-store' })
    const listing = await listed.json() as { data?: ApiTokenMetadata[] }
    if (listed.ok && listing.data) setTokens(listing.data)
    toast.success(graceMinutes === 0
      ? `${token.name} rotated — the previous secret no longer works`
      : `${token.name} rotated — the previous secret works for ${graceMinutes} more minutes`)
  }

  async function copySecret() {
    if (!secret) return
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    toast.success('Token copied')
  }

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <div>
          <h2 className="text-base font-semibold text-foreground">API tokens</h2>
          <p className="text-xs text-muted-foreground">Use tokens in CI/CD, scripts, and future CLI tools.</p>
        </div>
      </div>

      {secret && (
        <div className="m-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex gap-2">
            <Shield className="h-4 w-4 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Copy this token now</p>
              <p className="text-xs text-muted-foreground">It will never be shown again. Store it in a secret manager.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">{secret}</code>
            <Button type="button" variant="outline" onClick={copySecret} className="gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSecret(null)}>I have saved it</Button>
        </div>
      )}

      <form onSubmit={createToken} className="px-6 py-5 border-b border-border space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_110px_130px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="api-token-name">Name</Label>
            <Input id="api-token-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Production CI" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="api-token-scope">Scope</Label>
            <select id="api-token-scope" value={scope} onChange={(event) => setScope(event.target.value as 'read' | 'write')} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="read">Read</option>
              <option value="write">Write</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="api-token-expiry">Expires</Label>
            <select id="api-token-expiry" value={expiration} onChange={(event) => setExpiration(event.target.value as ExpirationChoice)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="never">Never</option>
            </select>
          </div>
          <LoadingButton type="submit" loading={creating} disabled={!name.trim()} className="gap-1.5 bg-blue-600 text-white hover:bg-blue-500" loadingText="Create">
            <Plus className="h-4 w-4" />
            Create
          </LoadingButton>
        </div>
        {scope === 'write' && <p className="text-xs text-amber-600">Write tokens can import and overwrite translations across this workspace.</p>}
        {expiration === 'never' && <p className="text-xs text-amber-600">Non-expiring credentials remain valid until explicitly revoked.</p>}
      </form>

      <div className="divide-y divide-border">
        {loading ? (
          <div className="px-6 py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : tokens.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No API tokens yet.</p>
        ) : collapseRotations(tokens, Date.now()).map(({ token, previous }) => {
          const inactive = Boolean(token.revokedAt) || Boolean(token.expiresAt && new Date(token.expiresAt) <= new Date())
          return (
            <div key={token.id} className="px-6 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{token.name}</span>
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{token.scope}</span>
                  {inactive && <span className="text-[11px] text-destructive">{token.revokedAt ? 'Revoked' : 'Expired'}</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <code>{token.tokenPrefix}</code> · Last used {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'never'} · {token.expiresAt ? `Expires ${new Date(token.expiresAt).toLocaleDateString()}` : 'No expiration'}
                </p>
                {/* The outgoing secret, stated as the deadline it is. Ending it
                    early is the one action that belongs here — and it is worded
                    against the previous secret, so it cannot be mistaken for
                    revoking the token that was just issued. */}
                {previous && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Previous secret <code>{previous.tokenPrefix}</code> still works until{' '}
                    {new Date(previous.expiresAt!).toLocaleTimeString()}
                    <button
                      type="button"
                      onClick={() => revokeToken(previous.id)}
                      className="ml-2 underline underline-offset-2 hover:text-amber-700"
                    >
                      Revoke it now
                    </button>
                  </p>
                )}
              </div>
              {!inactive && (
                <LoadingButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => rotateToken(token, 60)}
                  loadingText={<span className="sr-only">Rotating {token.name}</span>}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sr-only">Rotate {token.name}, old secret valid for one more hour</span>
                </LoadingButton>
              )}
              {!inactive && (
                <LoadingButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeToken(token.id)}
                  className="text-destructive hover:text-destructive"
                  loadingText={<span className="sr-only">Revoking {token.name}</span>}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Revoke {token.name}</span>
                </LoadingButton>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
