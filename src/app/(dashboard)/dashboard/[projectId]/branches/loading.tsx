export default function BranchesLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-4 h-4 bg-muted rounded animate-pulse" />
          <div className="w-24 h-4 bg-muted rounded animate-pulse" />
          <div className="w-2 h-4 bg-muted rounded animate-pulse" />
          <div className="w-32 h-4 bg-muted rounded animate-pulse" />
          <div className="flex-1" />
          <div className="w-28 h-8 bg-muted rounded animate-pulse" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-6 space-y-2">
          <div className="w-36 h-6 bg-muted rounded animate-pulse" />
          <div className="w-56 h-4 bg-muted/60 rounded animate-pulse" />
        </div>

        {/* Branch cards */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-5"
              style={{ opacity: 1 - i * 0.15 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 bg-muted rounded animate-pulse" />
                <div className="w-28 h-5 bg-muted rounded animate-pulse" />
                {i === 1 && <div className="w-14 h-5 bg-muted rounded-full animate-pulse" />}
                <div className="flex-1" />
                <div className="w-20 h-7 bg-muted rounded animate-pulse" />
                <div className="w-20 h-7 bg-muted rounded animate-pulse" />
              </div>
              <div className="flex gap-6 mt-2">
                <div className="w-20 h-3.5 bg-muted/60 rounded animate-pulse" />
                <div className="w-20 h-3.5 bg-muted/60 rounded animate-pulse" />
                <div className="w-28 h-3.5 bg-muted/60 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
