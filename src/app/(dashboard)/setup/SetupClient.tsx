'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signOut } from '@/lib/supabase/auth'

export function SetupClient() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json() as { data?: { id: string }; error?: string }

      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create workspace')
        return
      }

      const orgId = json.data?.id
      if (!orgId) {
        setError('Unexpected error: no workspace ID returned')
        return
      }

      router.push(`/projects?org=${orgId}`)
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative">
      <button
        onClick={() => void signOut()}
        className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Logo size={32} />
          <span className="text-xl font-bold text-zinc-100 tracking-tight">LangHub</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-zinc-100 mb-1">Welcome to LangHub</h1>
            <p className="text-sm text-zinc-400">Create your first workspace to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name" className="text-zinc-300">Workspace name</Label>
              <Input
                id="ws-name"
                placeholder="e.g. Acme Corp, My Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-blue-600"
              />
              <p className="text-[11px] text-zinc-600">
                You can add projects and invite teammates after creating your workspace.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isPending ? 'Creating workspace...' : 'Create workspace'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
