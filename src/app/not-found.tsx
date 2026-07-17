import Link from 'next/link'
import { ArrowLeft, Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.18),transparent_55%)]" />

      <Link href="/" className="mb-10 flex items-center gap-2 font-semibold tracking-tight">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="LangHub" className="h-8 w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon-white.png?v=3" alt="" aria-hidden="true" className="hidden h-8 w-auto dark:block" />
        <span>LangHub</span>
      </Link>

      <div className="inline-flex rounded-xl bg-blue-500/10 p-3 ring-1 ring-inset ring-blue-500/20">
        <Compass className="h-6 w-6 text-blue-600 dark:text-blue-400" />
      </div>
      <p className="mt-6 text-sm font-semibold text-blue-600 dark:text-blue-400">404</p>
      <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight">This page could not be found.</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you are looking for may have been moved, renamed, or never existed.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to home
        </Link>
        <Link
          href="/docs"
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Browse docs
        </Link>
      </div>
    </main>
  )
}
