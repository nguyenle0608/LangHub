export default function ImportLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-4 h-4 bg-muted rounded animate-pulse" />
          <div className="w-24 h-4 bg-muted rounded animate-pulse" />
          <div className="w-2 h-4 bg-accent rounded animate-pulse" />
          <div className="w-16 h-4 bg-muted rounded animate-pulse" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full animate-pulse ${i === 1 ? 'bg-blue-600/40' : 'bg-muted'}`} />
              <div className={`h-3.5 rounded animate-pulse ${i === 1 ? 'w-16 bg-accent' : 'w-20 bg-muted/60'}`} />
              {i < 3 && <div className="w-8 h-px bg-muted mx-1" />}
            </div>
          ))}
        </div>

        {/* Upload drop zone */}
        <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center gap-4 bg-card/30">
          <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
          <div className="w-48 h-5 bg-muted rounded animate-pulse" />
          <div className="w-64 h-4 bg-muted/60 rounded animate-pulse" />
          <div className="w-28 h-9 bg-muted rounded animate-pulse mt-2" />
        </div>
      </main>
    </div>
  )
}
