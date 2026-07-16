import Link from 'next/link'
import { ArrowRight, CheckCircle2, GitBranch, Globe2, History, Languages, Layers3, Sparkles, UsersRound } from 'lucide-react'
import { getSession } from '@/lib/supabase/session'
import { ThemeHeaderButton } from '@/components/theme/ThemeHeaderButton'
import { UserAccountMenu } from '@/components/auth/UserAccountMenu'

const features = [
  { icon: Languages, title: 'Translation editor', text: 'Manage keys and translations in one focused workspace with status-aware cells.' },
  { icon: UsersRound, title: 'Live collaboration', text: 'See who is editing a translation cell in real time, similar to Google Sheets presence.' },
  { icon: GitBranch, title: 'Branches and merge', text: 'Prepare localization work safely before merging it back into your main branch.' },
  { icon: History, title: 'Version history', text: 'Compare snapshots, inspect changes, and restore previous translation states.' },
  { icon: Globe2, title: 'Import and export', text: 'Round-trip common localization formats without leaving your browser.' },
]

const plans = [
  { name: 'Free', price: '$0', description: 'For solo projects getting localization organized.', cta: 'Start free' },
  { name: 'Pro', price: 'Soon', description: 'More projects, history, and workflow controls for growing apps.', cta: 'Coming soon' },
  { name: 'Team', price: 'Soon', description: 'Workspace roles, collaboration, and billing for product teams.', cta: 'Coming soon' },
]

export default async function LandingPage() {
  const session = await getSession()
  const isSignedIn = !!session
  const primaryHref = isSignedIn ? '/dashboard/projects' : '/signup'
  const primaryLabel = isSignedIn ? 'Open dashboard' : 'Start free'

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.18),transparent_55%)]" />

      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="LangHub" className="h-8 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon-white.png?v=3" alt="" aria-hidden="true" className="hidden h-8 w-auto dark:block" />
          <span>LangHub</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#workflow" className="hover:text-foreground">Workflow</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeHeaderButton />
          {isSignedIn ? (
            <>
              <Link href="/dashboard/projects" className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent">
                Dashboard
              </Link>
              <UserAccountMenu email={session.user.email} avatarClassName="h-7 w-7 text-[11px]" />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
                Sign in
              </Link>
              <Link href="/signup" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500">
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-14 lg:grid-cols-[1fr_440px] lg:items-center lg:pt-20">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm text-blue-700 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            Localization management for fast-moving apps
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Ship multilingual products without losing track of translations.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            LangHub gives developers and product teams a clean dashboard for translation keys, review status, live collaboration, branches, imports, exports, and version history.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500">
              {primaryLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#features" className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent">
              Explore features
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-2xl shadow-blue-950/10 backdrop-blur">
          <div className="rounded-xl border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Mobile App</p>
                <p className="text-xs text-muted-foreground">4 languages · 248 keys</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">82% ready</span>
            </div>
            <div className="space-y-2 p-4 text-sm">
              {['home.title', 'checkout.cta', 'profile.emptyState'].map((key, index) => (
                <div key={key} className="grid grid-cols-[1fr_1fr] gap-3 rounded-lg border border-border bg-card p-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{key}</p>
                    <p className="mt-1 text-foreground">{index === 0 ? 'Welcome back' : index === 1 ? 'Complete purchase' : 'No projects yet'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Spanish</p>
                    <p className="mt-1 text-foreground">{index === 0 ? 'Bienvenido' : index === 1 ? 'Completar compra' : 'Sin proyectos'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight">Everything core teams need before subscription scale.</h2>
          <p className="mt-3 text-muted-foreground">The fundamentals are now in place: editor, workflows, history, workspace roles, and import/export.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-border bg-card p-5">
              <feature.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="grid gap-8 md:grid-cols-[320px_1fr] md:items-start">
            <div>
              <Layers3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight">A workflow built for product iteration.</h2>
              <p className="mt-3 text-muted-foreground">Keep translation work close to development while giving teams enough process to review and ship confidently.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {['Create or import keys', 'Translate by locale', 'Review status and branches', 'Export or restore versions'].map((step) => (
                <div key={step} className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                  <span className="text-sm font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Subscription-ready pricing preview.</h2>
            <p className="mt-3 text-muted-foreground">Start with the product today. Billing plans will unlock as LangHub moves toward subscription.</p>
          </div>
          <UsersRound className="hidden h-8 w-8 text-muted-foreground md:block" />
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
              <p className="mt-3 text-3xl font-bold">{plan.price}</p>
              <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{plan.description}</p>
              <Link href={plan.name === 'Free' ? primaryHref : '#'} className="mt-6 inline-flex w-full justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent">
                {plan.name === 'Free' ? primaryLabel : plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-sm text-muted-foreground">
          <p>© 2026 LangHub. Localization workflow for modern apps.</p>
        </div>
      </footer>
    </main>
  )
}
