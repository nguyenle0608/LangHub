import Link from 'next/link'
import { getSession } from '@/lib/supabase/session'
import { getOrganizations } from '@/lib/supabase/queries/organizations'
import { ThemeHeaderButton } from '@/components/theme/ThemeHeaderButton'
import { UserAccountMenu } from '@/components/auth/UserAccountMenu'

/**
 * Shared marketing/content-page header. Auth-aware, mirrors the landing header
 * so standalone pages (docs, legal, changelog) stay visually consistent.
 */
export async function SiteHeader() {
  const session = await getSession()
  const isSignedIn = !!session
  const orgs = session?.user.id ? await getOrganizations(session.user.id) : []
  const accountPlan = orgs[0]?.plan ?? 'free'

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="LangHub" className="h-8 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon-white.png?v=3" alt="" aria-hidden="true" className="hidden h-8 w-auto dark:block" />
          <span>LangHub</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="/#features" className="transition-colors hover:text-foreground">Features</Link>
          <Link href="/docs" className="transition-colors hover:text-foreground">Docs</Link>
          <Link href="/changelog" className="transition-colors hover:text-foreground">Changelog</Link>
          <Link href="/#pricing" className="transition-colors hover:text-foreground">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeHeaderButton />
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard/projects"
                className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Dashboard
              </Link>
              <UserAccountMenu email={session.user.email} plan={accountPlan} avatarClassName="h-7 w-7 text-[11px]" />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
