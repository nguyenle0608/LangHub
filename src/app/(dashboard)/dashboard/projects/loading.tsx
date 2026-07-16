import { Logo } from '@/components/Logo'

export default function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={30} />
            <span className="font-semibold text-foreground tracking-tight">LangHub</span>
          </div>
          <div className="w-48 h-4 bg-muted rounded animate-pulse" />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="w-24 h-7 bg-muted rounded animate-pulse" />
            <div className="w-36 h-4 bg-muted rounded animate-pulse" />
          </div>
          <div className="w-32 h-9 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-xl border border-border bg-card/40 animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  )
}
