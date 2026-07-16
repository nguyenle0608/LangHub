export default function VersionsLoading() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Left sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        {/* Nav */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="w-4 h-4 bg-muted rounded animate-pulse" />
          <div className="w-20 h-4 bg-muted rounded animate-pulse flex-1" />
          <div className="w-14 h-7 bg-muted rounded animate-pulse" />
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="h-7 bg-muted/60 rounded animate-pulse" />
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card/40 p-3.5 space-y-2"
              style={{ opacity: 1 - i * 0.12 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 bg-muted rounded animate-pulse" />
                <div className="flex-1 h-4 bg-muted rounded animate-pulse" />
              </div>
              <div className="w-20 h-3 bg-muted/60 rounded animate-pulse" />
              <div className="h-1 bg-muted rounded-full animate-pulse" />
              <div className="flex gap-2">
                <div className="w-12 h-3 bg-muted/60 rounded animate-pulse" />
                <div className="w-12 h-3 bg-muted/60 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 bg-muted rounded-full mx-auto animate-pulse" />
          <div className="w-40 h-4 bg-muted rounded animate-pulse mx-auto" />
        </div>
      </div>
    </div>
  )
}
