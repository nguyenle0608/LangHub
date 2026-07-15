export default function OrgSettingsLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-28 h-4 bg-muted rounded animate-pulse" />
          <div className="w-2 h-4 bg-accent rounded animate-pulse" />
          <div className="w-28 h-4 bg-muted rounded animate-pulse" />
          <div className="w-2 h-4 bg-accent rounded animate-pulse" />
          <div className="w-16 h-4 bg-muted rounded animate-pulse" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Title */}
        <div className="space-y-1">
          <div className="w-48 h-7 bg-muted rounded animate-pulse" />
          <div className="w-64 h-4 bg-muted/60 rounded animate-pulse" />
        </div>

        {/* General */}
        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="w-16 h-5 bg-muted rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="flex-1 h-9 bg-muted/60 rounded-md animate-pulse" />
            <div className="w-16 h-9 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="flex gap-4">
            <div className="w-20 h-4 bg-muted/40 rounded animate-pulse" />
            <div className="w-20 h-4 bg-muted/40 rounded animate-pulse" />
            <div className="w-20 h-4 bg-muted/40 rounded animate-pulse" />
          </div>
        </section>

        {/* Members */}
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <div className="w-4 h-4 bg-muted rounded animate-pulse" />
            <div className="w-16 h-5 bg-muted rounded animate-pulse" />
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3">
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 h-4 bg-muted/60 rounded animate-pulse" />
                <div className="w-20 h-6 bg-muted/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-border bg-card/50">
            <div className="w-48 h-3.5 bg-muted/60 rounded animate-pulse mb-3" />
            <div className="flex gap-2">
              <div className="flex-1 h-9 bg-muted/60 rounded-md animate-pulse" />
              <div className="w-24 h-9 bg-muted/60 rounded-md animate-pulse" />
              <div className="w-16 h-9 bg-muted rounded-md animate-pulse" />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
