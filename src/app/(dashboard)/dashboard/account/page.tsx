import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, CreditCard, KeyRound, Mail, Sparkles, UserRound } from 'lucide-react'
import { getUser } from '@/lib/supabase/session'
import { getOrganizations } from '@/lib/supabase/queries/organizations'
import { ThemeHeaderButton } from '@/components/theme/ThemeHeaderButton'
import { UserAccountMenu } from '@/components/auth/UserAccountMenu'
import { Badge } from '@/components/ui/badge'

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: { next?: string }
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const orgs = await getOrganizations(user.id)
  const accountPlan = orgs[0]?.plan ?? 'free'
  const avatarColor = stringToColor(user.email ?? user.id)
  const backHref = getSafeBackHref(searchParams?.next)
  const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) : '—'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <span className="text-border">/</span>
            <span className="text-sm font-medium text-foreground">Account</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeHeaderButton />
            <UserAccountMenu email={user.email} plan={accountPlan} avatarColor={avatarColor} avatarClassName="h-7 w-7 text-[11px]" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">User management</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Account settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage your sign-in details, password, workspace access, and account subscription overview.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white"
                  style={{ backgroundColor: avatarColor }}
                >
                  {(user.email?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">Profile</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Basic identity from your authenticated account.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <InfoItem icon={Mail} label="Email" value={user.email ?? 'Unknown'} />
                    <InfoItem icon={UserRound} label="User ID" value={user.id} mono />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Security</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Update your password for email sign-in.</p>
                </div>
                <Link href="/change-password" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500">
                  <KeyRound className="h-4 w-4" />
                  Change password
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Workspaces</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Your workspace access. Subscription is managed at the account level.</p>
                </div>
                <Link href="/dashboard/projects" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                  Open dashboard
                </Link>
              </div>

              {orgs.length > 0 ? (
                <div className="divide-y divide-border rounded-xl border border-border">
                  {orgs.map((org) => {
                    const canManage = org.role === 'owner' || org.role === 'admin'
                    return (
                      <div key={org.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{org.name}</p>
                            <Badge variant="outline" className="capitalize">{org.role}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {org.project_count} project{org.project_count === 1 ? '' : 's'} · {org.member_count} member{org.member_count === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/projects?org=${org.id}`} className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent">
                            View
                          </Link>
                          {canManage && (
                            <Link href={`/dashboard/orgs/${org.id}/settings`} className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent">
                              Manage
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  You do not have a workspace yet. Create one from the dashboard to start managing projects.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CreditCard className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">Subscription</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your account-level plan. Billing management will be connected later.</p>
              <div className="mt-5 rounded-xl bg-muted p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current plan</p>
                <p className="mt-2 text-2xl font-bold capitalize">{accountPlan}</p>
                <p className="mt-1 text-xs text-muted-foreground">Account billing integration is coming soon.</p>
              </div>
              <button
                type="button"
                disabled
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground opacity-70"
                title="Subscription management is coming soon"
              >
                <Sparkles className="h-4 w-4" />
                Manage billing soon
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
              <p className="font-medium text-foreground">Account created</p>
              <p className="mt-1">{createdAt}</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof Mail
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={mono ? 'truncate font-mono text-xs text-foreground' : 'truncate text-sm font-medium text-foreground'} title={value}>
        {value}
      </p>
    </div>
  )
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 55%, 40%)`
}

function getSafeBackHref(next?: string): string {
  if (!next) return '/dashboard/projects'
  if (!next.startsWith('/dashboard') || next.startsWith('//')) return '/dashboard/projects'
  if (next.startsWith('/dashboard/account')) return '/dashboard/projects'
  return next
}
