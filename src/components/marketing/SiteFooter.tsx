import Link from 'next/link'

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Workflow', href: '/#workflow' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Sign in', href: '/login' },
      { label: 'Get started', href: '/signup' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
]

/** Shared marketing/content-page footer with sitemap columns. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="LangHub" className="h-7 w-auto dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon-white.png?v=3" alt="" aria-hidden="true" className="hidden h-7 w-auto dark:block" />
            <span>LangHub</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Localization workflow for modern apps. Keep every locale, branch, and version in one place.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-semibold">{column.title}</p>
            <ul className="mt-3 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 max-w-6xl px-6 text-sm text-muted-foreground">
        <p>© 2026 LangHub. Localization workflow for modern apps.</p>
      </div>
    </footer>
  )
}
