export default function KeysLoading() {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
        <div className="w-4 h-4 bg-muted rounded animate-pulse" />
        <div className="w-24 h-4 bg-muted rounded animate-pulse" />
        <div className="w-2 h-4 bg-accent rounded animate-pulse" />
        <div className="w-28 h-4 bg-muted rounded animate-pulse" />
        <div className="flex-1" />
        <div className="w-24 h-7 bg-muted rounded animate-pulse" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Warning banner */}
        <div className="mx-6 mt-5 mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 flex gap-2">
          <div className="w-4 h-4 bg-yellow-500/20 rounded animate-pulse flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <div className="w-40 h-4 bg-muted rounded animate-pulse" />
            <div className="w-full h-3.5 bg-muted/60 rounded animate-pulse" />
          </div>
        </div>

        {/* Legend */}
        <div className="mx-6 mb-5 flex gap-4">
          <div className="w-28 h-3.5 bg-muted/60 rounded animate-pulse" />
          <div className="w-28 h-3.5 bg-muted/60 rounded animate-pulse" />
        </div>

        {/* Duplicate groups */}
        <div className="mx-6 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden" style={{ opacity: 1 - i * 0.2 }}>
              <div className="px-4 py-3 border-b border-border bg-card/60 flex items-center gap-2">
                <div className="w-32 h-4 bg-muted rounded animate-pulse" />
                <div className="flex-1" />
                <div className="w-20 h-6 bg-muted rounded animate-pulse" />
              </div>
              {[1, 2].map((j) => (
                <div key={j} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
                  <div className="w-4 h-4 bg-muted/60 rounded animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="w-48 h-3.5 bg-muted rounded animate-pulse" />
                    <div className="w-32 h-3 bg-muted/60 rounded animate-pulse" />
                  </div>
                  <div className="w-16 h-6 bg-muted/40 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
