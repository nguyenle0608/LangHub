import { Logo } from '@/components/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size={64} />
          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground tracking-tight">LangHub</p>
            <p className="text-muted-foreground text-sm mt-0.5">Localization Management Tool</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
