'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, UserMinus, UsersRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { OrgMember, OrgWithStats, MemberRole } from '@/types'
import { ApiTokensPanel } from './ApiTokensPanel'
import { GlossaryPanel } from './GlossaryPanel'

interface Props {
  org: OrgWithStats
  members: OrgMember[]
  currentUserId: string
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  translator: 'Translator',
  viewer: 'Viewer',
}

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  admin: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  translator: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800',
  viewer: 'bg-muted text-muted-foreground border-border',
}

export function OrgSettingsClient({ org, members: initialMembers, currentUserId }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [orgName, setOrgName] = useState(org.name)
  const [isSavingName, startSavingName] = useTransition()
  // Per-member in-flight ops (role change / remove) → disable that row's controls
  const [pendingMembers, setPendingMembers] = useState<Set<string>>(new Set())
  const setMemberPending = (id: string, on: boolean) =>
    setPendingMembers((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n })

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'translator' | 'viewer'>('translator')
  const [isInviting, startInviting] = useTransition()

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [isDeleting, startDeleting] = useTransition()

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    startSavingName(async () => {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName }),
      })
      if (res.ok) {
        toast.success('Workspace name updated')
        router.refresh()
      } else {
        toast.error('Failed to update workspace name')
      }
    })
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    startInviting(async () => {
      const res = await fetch(`/api/organizations/${org.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const json = await res.json() as { error?: string }
      if (res.ok) {
        toast.success(`Invited ${inviteEmail}`)
        setInviteEmail('')
        // Refresh members list
        const membersRes = await fetch(`/api/organizations/${org.id}/members`)
        const membersJson = await membersRes.json() as { data?: OrgMember[] }
        if (membersJson.data) setMembers(membersJson.data)
      } else {
        toast.error(typeof json.error === 'string' ? json.error : 'Failed to invite member')
      }
    })
  }

  async function handleRemoveMember(memberId: string, memberEmail: string | null) {
    setMemberPending(memberId, true)
    try {
      const res = await fetch(`/api/organizations/${org.id}/members/${memberId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success(`Removed ${memberEmail ?? 'member'}`)
        setMembers((prev) => prev.filter((m) => m.id !== memberId))
      } else {
        toast.error('Failed to remove member')
      }
    } finally {
      setMemberPending(memberId, false)
    }
  }

  async function handleRoleChange(memberId: string, role: MemberRole) {
    setMemberPending(memberId, true)
    try {
      const res = await fetch(`/api/organizations/${org.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (res.ok) {
        toast.success('Role updated')
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role } : m))
        )
      } else {
        toast.error('Failed to update role')
      }
    } finally {
      setMemberPending(memberId, false)
    }
  }

  async function handleDeleteOrg() {
    startDeleting(async () => {
      const res = await fetch(`/api/organizations/${org.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`Workspace "${org.name}" deleted`)
        router.push('/dashboard/projects')
      } else {
        const json = await res.json() as { error?: string }
        toast.error(typeof json.error === 'string' ? json.error : 'Failed to delete workspace')
      }
    })
  }

  const isOwner = org.role === 'owner'

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <a
            href={`/dashboard/projects?org=${org.id}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </a>
          <span className="text-border">/</span>
          <span className="text-sm text-muted-foreground truncate">{org.name}</span>
          <span className="text-border">/</span>
          <span className="text-sm text-foreground">Settings</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workspace settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your workspace and team members</p>
        </div>

        {/* General Settings */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">General</h2>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-name-edit" className="text-foreground">Workspace name</Label>
              <div className="flex gap-2">
                <Input
                  id="org-name-edit"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  className="bg-muted border-border text-foreground focus-visible:ring-blue-600"
                />
                <Button
                  type="submit"
                  disabled={isSavingName || !orgName.trim() || orgName === org.name}
                  className="bg-blue-600 hover:bg-blue-500 text-white flex-shrink-0"
                >
                  {isSavingName ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{org.member_count} member{org.member_count !== 1 ? 's' : ''}</span>
              <span>{org.project_count} project{org.project_count !== 1 ? 's' : ''}</span>
            </div>
          </form>
        </section>

        {/* Members */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Members</h2>
          </div>

          {/* Members list */}
          <div className="divide-y divide-border">
            {members.map((member) => {
              const isCurrentUser = member.user_id === currentUserId
              const canModify = isOwner && !isCurrentUser && member.role !== 'owner'

              return (
                <div key={member.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-8 h-8 rounded-full border border-border bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-foreground uppercase">
                      {(member.email ?? member.user_id).charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {member.email ?? member.user_id}
                      {isCurrentUser && <span className="text-muted-foreground text-xs ml-1">(you)</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canModify ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as MemberRole)}
                        disabled={pendingMembers.has(member.id)}
                        className="text-xs bg-muted border border-border text-foreground rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
                      >
                        <option value="admin">Admin</option>
                        <option value="translator">Translator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded border ${ROLE_COLORS[member.role]}`}>
                        {ROLE_LABELS[member.role]}
                      </span>
                    )}
                    {canModify && (
                      <button
                        onClick={() => handleRemoveMember(member.id, member.email)}
                        disabled={pendingMembers.has(member.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 disabled:opacity-50"
                        title="Remove member"
                      >
                        {pendingMembers.has(member.id)
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <UserMinus className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Invite form */}
          <div className="px-6 py-4 border-t border-border bg-card/50">
            <p className="text-xs text-muted-foreground mb-3">Invite a teammate by their account email</p>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="teammate@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-blue-600 flex-1"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'translator' | 'viewer')}
                className="text-sm bg-muted border border-border text-foreground rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="admin">Admin</option>
                <option value="translator">Translator</option>
                <option value="viewer">Viewer</option>
              </select>
              <Button
                type="submit"
                disabled={isInviting || !inviteEmail.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white flex-shrink-0"
              >
                {isInviting ? 'Inviting…' : 'Invite'}
              </Button>
            </form>
          </div>
        </section>

        <ApiTokensPanel orgId={org.id} />

        <GlossaryPanel orgId={org.id} canManage={org.role === 'owner' || org.role === 'admin'} />

        {/* Danger Zone — owners only */}
        {isOwner && (
          <section className="bg-card border border-destructive/25 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-destructive/20 bg-destructive/5">
              <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Delete workspace</p>
                <p className="text-sm text-muted-foreground mb-3">
                  This permanently deletes the workspace and all its projects, translation keys, and translations.
                  This action cannot be undone.
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  Type <span className="font-mono text-foreground bg-muted px-1 py-0.5 rounded">{org.name}</span> to confirm
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder={org.name}
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-red-600 max-w-xs"
                  />
                  <Button
                    type="button"
                    onClick={handleDeleteOrg}
                    disabled={isDeleting || deleteConfirm !== org.name}
                    className="bg-red-700 hover:bg-red-600 text-white disabled:opacity-40 flex gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeleting ? 'Deleting…' : 'Delete workspace'}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
