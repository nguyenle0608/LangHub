type Section = {
  heading: string
  body: string
}

type LegalDocumentProps = {
  title: string
  updated: string
  sections: Section[]
}

/** Shared layout for static legal pages (terms, privacy). */
export function LegalDocument({ title, updated, sections }: LegalDocumentProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <header>
        <h1 className="text-balance text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
      </header>

      <div
        role="note"
        className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
      >
        This is a starting template. Review it with legal counsel before relying on it in production.
      </div>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            <p className="mt-2 leading-7 text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  )
}
