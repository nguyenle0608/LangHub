export default function EditorLoading() {
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
        <div className="w-32 h-5 bg-zinc-800 rounded animate-pulse" />
        <div className="flex-1" />
        <div className="w-24 h-7 bg-zinc-800 rounded animate-pulse" />
        <div className="w-24 h-7 bg-zinc-800 rounded animate-pulse" />
        <div className="w-24 h-7 bg-zinc-800 rounded animate-pulse" />
      </div>

      {/* Table header */}
      <div className="flex items-center gap-0 border-b border-zinc-800 bg-zinc-900/60 px-4 h-9 flex-shrink-0">
        <div className="w-5 h-4 bg-zinc-800 rounded animate-pulse mr-3" />
        <div className="w-44 h-4 bg-zinc-800 rounded animate-pulse mr-6" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 px-4">
            <div className="w-16 h-4 bg-zinc-800 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-0 border-b border-zinc-800/50 px-4 h-12"
            style={{ opacity: 1 - i * 0.07 }}
          >
            <div className="w-5 h-4 bg-zinc-800/60 rounded animate-pulse mr-3" />
            <div className="w-44 mr-6">
              <div className="w-32 h-3.5 bg-zinc-800/60 rounded animate-pulse" />
            </div>
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex-1 px-4">
                <div
                  className="h-3.5 bg-zinc-800/60 rounded animate-pulse"
                  style={{ width: `${55 + ((i * 3 + j * 7) % 35)}%` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
