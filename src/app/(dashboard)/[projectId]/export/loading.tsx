export default function ExportLoading() {
  return (
    <div className="h-screen bg-background">
      {/* Sheet overlay skeleton */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-card border-l border-border flex flex-col shadow-2xl">
        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="space-y-1.5">
            <div className="w-28 h-5 bg-muted rounded animate-pulse" />
            <div className="w-44 h-3.5 bg-muted/60 rounded animate-pulse" />
          </div>
          <div className="w-7 h-7 bg-muted rounded animate-pulse" />
        </div>

        {/* Format selector */}
        <div className="px-5 py-4 border-b border-border space-y-3">
          <div className="w-20 h-4 bg-muted rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-muted/60 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>

        {/* Locale selector */}
        <div className="px-5 py-4 flex-1 space-y-3">
          <div className="w-28 h-4 bg-muted rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-4 h-4 bg-muted rounded animate-pulse" />
                <div className="w-6 h-6 bg-muted/60 rounded-sm animate-pulse" />
                <div className="w-28 h-4 bg-muted/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <div className="h-10 bg-blue-600/30 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  )
}
