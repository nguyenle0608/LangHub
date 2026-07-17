import type { Metadata } from 'next'
import { Sparkles } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Changelog · LangHub',
  description: 'New features, improvements, and fixes shipped in LangHub.',
}

type ChangeType = 'New' | 'Improved' | 'Fixed'

type Release = {
  date: string
  title: string
  changes: { type: ChangeType; text: string }[]
}

const typeStyles: Record<ChangeType, string> = {
  New: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/20',
  Improved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20',
  Fixed: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20',
}

const releases: Release[] = [
  {
    date: 'July 2026',
    title: 'Public site & account management',
    changes: [
      { type: 'New', text: 'Public landing page and dashboard routes.' },
      { type: 'New', text: 'Account management overview.' },
      { type: 'Improved', text: 'Settings navigation and light theme polish.' },
      { type: 'Fixed', text: 'Pinned the landing header on scroll.' },
    ],
  },
  {
    date: 'June 2026',
    title: 'Git-style branching',
    changes: [
      { type: 'New', text: 'Per-branch translation keys with branch and merge workflow.' },
      { type: 'Improved', text: 'Value-level branching foundations across the editor.' },
      { type: 'Fixed', text: 'Empty exports for projects with large key sets.' },
    ],
  },
  {
    date: 'May 2026',
    title: 'Editor & workflow',
    changes: [
      { type: 'New', text: 'Version history with snapshot compare and restore.' },
      { type: 'Improved', text: 'Manage-languages dialog now has a backdrop.' },
      { type: 'New', text: 'Import and export for common localization formats.' },
    ],
  },
]

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <header className="max-w-2xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm text-blue-700 dark:text-blue-300">
          <Sparkles className="h-3.5 w-3.5" />
          Changelog
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight">What&apos;s new in LangHub.</h1>
        <p className="mt-3 text-lg leading-8 text-muted-foreground">
          Features, improvements, and fixes as the product moves toward general availability.
        </p>
      </header>

      <div className="mt-12 space-y-12 border-l border-border pl-8">
        {releases.map((release) => (
          <section key={release.title} className="relative">
            <span className="absolute -left-[2.35rem] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-blue-600" />
            <p className="text-sm font-medium text-muted-foreground">{release.date}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{release.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {release.changes.map((change) => (
                <li key={change.text} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${typeStyles[change.type]}`}
                  >
                    {change.type}
                  </span>
                  <span className="text-sm leading-6 text-muted-foreground">{change.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
