import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  FileJson,
  GitBranch,
  Globe2,
  History,
  Languages,
  Layers3,
  Radio,
  Sparkles,
  UsersRound,
  Zap,
} from 'lucide-react'
import { getSession } from '@/lib/supabase/session'
import { getOrganizations } from '@/lib/supabase/queries/organizations'
import { ThemeHeaderButton } from '@/components/theme/ThemeHeaderButton'
import { UserAccountMenu } from '@/components/auth/UserAccountMenu'
import { Reveal } from '@/components/marketing/Reveal'

const features = [
  {
    icon: Languages,
    title: 'Translation editor',
    text: 'Manage keys and translations in one focused workspace with status-aware cells.',
  },
  {
    icon: UsersRound,
    title: 'Live collaboration',
    text: 'See who is editing a translation cell in real time, similar to Google Sheets presence.',
  },
  {
    icon: GitBranch,
    title: 'Branches and merge',
    text: 'Prepare localization work safely before merging it back into your main branch.',
  },
  {
    icon: History,
    title: 'Version history',
    text: 'Compare snapshots, inspect changes, and restore previous translation states.',
  },
  {
    icon: Globe2,
    title: 'Import and export',
    text: 'Round-trip common localization formats without leaving your browser.',
  },
]

const stats = [
  { icon: Radio, label: 'Real-time presence' },
  { icon: GitBranch, label: 'Git-style branches' },
  { icon: History, label: 'Full version history' },
  { icon: FileJson, label: 'Import & export' },
]

const workflowSteps = [
  { title: 'Create or import keys', text: 'Start from scratch or bring existing JSON, and keep everything in dot.notation.' },
  { title: 'Translate by locale', text: 'Edit each language with status-aware cells and live teammate presence.' },
  { title: 'Review status and branches', text: 'Track what is ready and stage risky changes on a branch before merge.' },
  { title: 'Export or restore versions', text: 'Ship clean locale files, or roll back to any earlier snapshot in one click.' },
]

const plans = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    description: 'For solo projects getting localization organized.',
    cta: 'Start free',
    featured: false,
    features: ['1 workspace', 'Unlimited translation keys', 'Import & export', 'Version history'],
  },
  {
    name: 'Pro',
    price: 'Soon',
    cadence: '',
    description: 'More projects, history, and workflow controls for growing apps.',
    cta: 'Coming soon',
    featured: true,
    features: ['Everything in Free', 'Multiple projects', 'Branches & merge', 'Priority support'],
  },
  {
    name: 'Team',
    price: 'Soon',
    cadence: '',
    description: 'Workspace roles, collaboration, and billing for product teams.',
    cta: 'Coming soon',
    featured: false,
    features: ['Everything in Pro', 'Workspace roles', 'Live collaboration', 'Team billing'],
  },
]

const presence = [
  { initials: 'MK', className: 'bg-blue-500' },
  { initials: 'AR', className: 'bg-emerald-500' },
  { initials: 'JD', className: 'bg-purple-500' },
]

export default async function LandingPage() {
  const session = await getSession()
  const isSignedIn = !!session
  const primaryHref = isSignedIn ? '/dashboard/projects' : '/signup'
  const primaryLabel = isSignedIn ? 'Open dashboard' : 'Start free'
  const orgs = session?.user.id ? await getOrganizations(session.user.id) : []
  const accountPlan = orgs[0]?.plan ?? 'free'

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.20),transparent_58%)]" />
      <div className="animate-drift pointer-events-none absolute right-0 top-40 -z-10 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.12),transparent_65%)] blur-2xl" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="LangHub" className="h-8 w-auto dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon-white.png?v=3" alt="" aria-hidden="true" className="hidden h-8 w-auto dark:block" />
            <span>LangHub</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#workflow" className="transition-colors hover:text-foreground">Workflow</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeHeaderButton />
            {isSignedIn ? (
              <>
                <Link href="/dashboard/projects" className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Dashboard
                </Link>
                <UserAccountMenu email={session.user.email} plan={accountPlan} avatarClassName="h-7 w-7 text-[11px]" />
              </>
            ) : (
              <>
                <Link href="/login" className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Sign in
                </Link>
                <Link href="/signup" className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-28 lg:grid-cols-[1fr_460px] lg:items-center lg:pt-32">
        <Reveal className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm text-blue-700 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            Localization management for fast-moving apps
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Ship multilingual products without{' '}
            <span className="animate-gradient-pan bg-gradient-to-r from-blue-500 via-emerald-400 to-blue-500 bg-clip-text text-transparent">
              losing track
            </span>{' '}
            of translations.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            LangHub gives developers and product teams a clean dashboard for translation keys, review status, live collaboration, branches, imports, exports, and version history.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={primaryHref} className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 hover:shadow-blue-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              {primaryLabel}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="#features" className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Explore features
            </Link>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            No credit card required · Free forever tier
          </p>
        </Reveal>

        <Reveal delay={120} className="animate-float rounded-2xl border border-border bg-card/80 p-4 shadow-2xl shadow-blue-950/10 backdrop-blur">
          <div className="rounded-xl border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Mobile App</p>
                <p className="text-xs text-muted-foreground">4 languages · 248 keys</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Live indicator */}
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="animate-pulse-ring relative inline-flex h-2 w-2 text-emerald-500">
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
                {/* Live presence avatars */}
                <div className="flex -space-x-2">
                  {presence.map((person) => (
                    <span
                      key={person.initials}
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white ${person.className}`}
                    >
                      {person.initials}
                    </span>
                  ))}
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">82% ready</span>
              </div>
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
        </Reveal>
      </section>

      {/* Social proof / capability strip */}
      <section className="border-y border-border/60 bg-card/30">
        <Reveal className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-6 text-sm text-muted-foreground sm:justify-between">
          {stats.map((stat) => (
            <span key={stat.label} className="inline-flex items-center gap-2">
              <stat.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              {stat.label}
            </span>
          ))}
        </Reveal>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <Reveal className="max-w-2xl">
          <h2 className="text-balance text-3xl font-bold tracking-tight">Everything core teams need before subscription scale.</h2>
          <p className="mt-3 text-muted-foreground">The fundamentals are now in place: editor, workflows, history, workspace roles, and import/export.</p>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal
              key={feature.title}
              delay={index * 70}
              className={`group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-950/10 ${index === 0 ? 'lg:col-span-2' : ''}`}
            >
              <div className="inline-flex rounded-lg bg-blue-500/10 p-2.5 ring-1 ring-inset ring-blue-500/20 transition-colors group-hover:bg-blue-500/20">
                <feature.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <Reveal className="rounded-2xl border border-border bg-card p-6 md:p-10">
          <div className="grid gap-10 md:grid-cols-[320px_1fr] md:items-start">
            <div>
              <div className="inline-flex rounded-lg bg-blue-500/10 p-2.5 ring-1 ring-inset ring-blue-500/20">
                <Layers3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight">A workflow built for product iteration.</h2>
              <p className="mt-3 text-muted-foreground">Keep translation work close to development while giving teams enough process to review and ship confidently.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="rounded-lg border border-border bg-background p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold">{step.title}</span>
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <Reveal className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-balance text-3xl font-bold tracking-tight">Subscription-ready pricing preview.</h2>
            <p className="mt-3 text-muted-foreground">Start with the product today. Billing plans will unlock as LangHub moves toward subscription.</p>
          </div>
          <UsersRound className="hidden h-8 w-8 text-muted-foreground md:block" />
        </Reveal>
        <div className="mt-10 grid items-start gap-4 md:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal
              key={plan.name}
              delay={index * 80}
              className={`relative rounded-xl border bg-card p-6 transition-all hover:-translate-y-1 ${
                plan.featured
                  ? 'border-blue-500/60 shadow-lg shadow-blue-600/10 ring-1 ring-blue-500/30'
                  : 'border-border hover:border-blue-500/40'
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  Recommended
                </span>
              )}
              <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.cadence && <span className="text-sm text-muted-foreground">{plan.cadence}</span>}
              </p>
              <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{plan.description}</p>
              <ul className="mt-4 space-y-2.5">
                {plan.features.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.name === 'Free' ? primaryHref : '#'}
                aria-disabled={plan.name !== 'Free'}
                className={`mt-6 inline-flex w-full cursor-pointer justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  plan.featured
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'border border-border text-foreground hover:bg-accent'
                }`}
              >
                {plan.name === 'Free' ? primaryLabel : plan.cta}
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/15 via-card to-card p-8 text-center md:p-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.25),transparent_60%)]" />
          <div className="relative">
            <div className="mx-auto mb-5 inline-flex rounded-lg bg-blue-500/10 p-2.5 ring-1 ring-inset ring-blue-500/20">
              <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">Bring order to your translations today.</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Set up your first project in minutes. Keep every locale, branch, and version in one place.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={primaryHref} className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                {primaryLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              {!isSignedIn && (
                <Link href="/login" className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="LangHub" className="h-7 w-auto dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon-white.png?v=3" alt="" aria-hidden="true" className="hidden h-7 w-auto dark:block" />
            <span>LangHub</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#workflow" className="transition-colors hover:text-foreground">Workflow</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            <Link href="/login" className="transition-colors hover:text-foreground">Sign in</Link>
          </nav>
        </div>
        <div className="mx-auto mt-6 max-w-6xl px-6 text-sm text-muted-foreground">
          <p>© 2026 LangHub. Localization workflow for modern apps.</p>
        </div>
      </footer>
    </main>
  )
}
