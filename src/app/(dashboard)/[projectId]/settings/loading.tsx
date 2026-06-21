export default function ProjectSettingsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-14 h-4 bg-zinc-800 rounded animate-pulse" />
          <div className="w-2 h-4 bg-zinc-700 rounded animate-pulse" />
          <div className="w-24 h-4 bg-zinc-800 rounded animate-pulse" />
          <div className="w-2 h-4 bg-zinc-700 rounded animate-pulse" />
          <div className="w-16 h-4 bg-zinc-800 rounded animate-pulse" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* General section */}
        <section>
          <div className="w-20 h-6 bg-zinc-800 rounded animate-pulse mb-4" />
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
            <div className="space-y-1.5">
              <div className="w-24 h-4 bg-zinc-800 rounded animate-pulse" />
              <div className="h-9 bg-zinc-800/60 rounded-md animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="w-24 h-4 bg-zinc-800 rounded animate-pulse" />
              <div className="h-9 bg-zinc-800/60 rounded-md animate-pulse" />
            </div>
            <div className="w-28 h-9 bg-zinc-800 rounded animate-pulse" />
          </div>
        </section>

        {/* Languages section */}
        <section>
          <div className="w-24 h-6 bg-zinc-800 rounded animate-pulse mb-1" />
          <div className="w-64 h-4 bg-zinc-800/60 rounded animate-pulse mb-4" />
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-zinc-800 rounded-sm animate-pulse" />
                  <div className="w-24 h-4 bg-zinc-800 rounded animate-pulse" />
                  <div className="w-8 h-4 bg-zinc-800/60 rounded animate-pulse" />
                </div>
                <div className="w-10 h-4 bg-zinc-800/60 rounded animate-pulse" />
              </div>
            ))}
            <div className="h-9 bg-zinc-800/40 rounded-md animate-pulse mt-2" />
          </div>
        </section>

        {/* Danger zone */}
        <section>
          <div className="w-28 h-6 bg-zinc-800 rounded animate-pulse mb-4" />
          <div className="bg-zinc-900 border border-red-900/30 rounded-xl p-6 space-y-4">
            <div className="space-y-2">
              <div className="w-28 h-4 bg-zinc-800 rounded animate-pulse" />
              <div className="w-full h-4 bg-zinc-800/60 rounded animate-pulse" />
              <div className="w-3/4 h-4 bg-zinc-800/60 rounded animate-pulse" />
            </div>
            <div className="flex gap-2 mt-4">
              <div className="w-48 h-9 bg-zinc-800/60 rounded-md animate-pulse" />
              <div className="w-32 h-9 bg-red-900/30 rounded-md animate-pulse" />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
