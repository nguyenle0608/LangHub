export default function OrgSettingsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-28 h-4 bg-zinc-800 rounded animate-pulse" />
          <div className="w-2 h-4 bg-zinc-700 rounded animate-pulse" />
          <div className="w-28 h-4 bg-zinc-800 rounded animate-pulse" />
          <div className="w-2 h-4 bg-zinc-700 rounded animate-pulse" />
          <div className="w-16 h-4 bg-zinc-800 rounded animate-pulse" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Title */}
        <div className="space-y-1">
          <div className="w-48 h-7 bg-zinc-800 rounded animate-pulse" />
          <div className="w-64 h-4 bg-zinc-800/60 rounded animate-pulse" />
        </div>

        {/* General */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="w-16 h-5 bg-zinc-800 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="flex-1 h-9 bg-zinc-800/60 rounded-md animate-pulse" />
            <div className="w-16 h-9 bg-zinc-800 rounded-md animate-pulse" />
          </div>
          <div className="flex gap-4">
            <div className="w-20 h-4 bg-zinc-800/40 rounded animate-pulse" />
            <div className="w-20 h-4 bg-zinc-800/40 rounded animate-pulse" />
            <div className="w-20 h-4 bg-zinc-800/40 rounded animate-pulse" />
          </div>
        </section>

        {/* Members */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-2">
            <div className="w-4 h-4 bg-zinc-800 rounded animate-pulse" />
            <div className="w-16 h-5 bg-zinc-800 rounded animate-pulse" />
          </div>
          <div className="divide-y divide-zinc-800">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse flex-shrink-0" />
                <div className="flex-1 h-4 bg-zinc-800/60 rounded animate-pulse" />
                <div className="w-20 h-6 bg-zinc-800/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
            <div className="w-48 h-3.5 bg-zinc-800/60 rounded animate-pulse mb-3" />
            <div className="flex gap-2">
              <div className="flex-1 h-9 bg-zinc-800/60 rounded-md animate-pulse" />
              <div className="w-24 h-9 bg-zinc-800/60 rounded-md animate-pulse" />
              <div className="w-16 h-9 bg-zinc-800 rounded-md animate-pulse" />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
