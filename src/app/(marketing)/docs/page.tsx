import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, Download, GitBranch, History, KeyRound, Languages } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Docs · LangHub',
  description: 'Learn how to set up projects, manage translations, and ship localized apps with LangHub.',
}

const quickstart = [
  { step: 'Create a workspace', text: 'Sign up and set up your first organization workspace.' },
  { step: 'Add a project', text: 'Create a project and pick your base locale.' },
  { step: 'Import or add keys', text: 'Bring existing JSON or add translation keys in dot.notation.' },
  { step: 'Translate & export', text: 'Fill in each locale, review status, then export clean files.' },
]

const guides = [
  { icon: KeyRound, title: 'Translation keys', text: 'Keys are stored in dot.notation and rebuilt into nested files on export.' },
  { icon: Languages, title: 'Locales & status', text: 'Track review status per cell so you always know what is ready to ship.' },
  { icon: GitBranch, title: 'Branches & merge', text: 'Stage risky localization changes on a branch and merge when ready.' },
  { icon: History, title: 'Version history', text: 'Every destructive action snapshots first, so you can restore anytime.' },
  { icon: Download, title: 'Import & export', text: 'Round-trip common localization formats without leaving the browser.' },
  { icon: BookOpen, title: 'Concepts', text: 'Understand how projects, organizations, and roles fit together.' },
]

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <header className="max-w-2xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm text-blue-700 dark:text-blue-300">
          <BookOpen className="h-3.5 w-3.5" />
          Documentation
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight">Get started with LangHub.</h1>
        <p className="mt-3 text-lg leading-8 text-muted-foreground">
          Everything you need to set up projects, manage translations, and ship localized apps with confidence.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">Quickstart</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickstart.map((item, index) => (
            <li key={item.step} className="rounded-xl border border-border bg-card p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <p className="mt-3 font-semibold">{item.step}</p>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight">Guides</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <div key={guide.title} className="group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-950/10">
              <div className="inline-flex rounded-lg bg-blue-500/10 p-2.5 ring-1 ring-inset ring-blue-500/20 transition-colors group-hover:bg-blue-500/20">
                <guide.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mt-4 font-semibold">{guide.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{guide.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/15 via-card to-card p-8 text-center">
        <h2 className="text-balance text-2xl font-bold tracking-tight">Ready to try it?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">Create your first project and see the workflow end to end.</p>
        <Link
          href="/signup"
          className="group mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Start free
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </section>
    </div>
  )
}
