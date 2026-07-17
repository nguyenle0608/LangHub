'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the error for observability; replace with a real logger later.
    console.error(error)
  }, [error])

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.14),transparent_55%)]" />

      <Link href="/" className="mb-10 flex items-center gap-2 font-semibold tracking-tight">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="LangHub" className="h-8 w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon-white.png?v=3" alt="" aria-hidden="true" className="hidden h-8 w-auto dark:block" />
        <span>LangHub</span>
      </Link>

      <div className="inline-flex rounded-xl bg-destructive/10 p-3 ring-1 ring-inset ring-destructive/20">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight">Something went wrong.</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        An unexpected error occurred. You can try again, or head back to the home page.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <RotateCw className="h-4 w-4 transition-transform group-hover:rotate-90" />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
