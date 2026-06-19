import Link from 'next/link'
import type { ProjectWithStats } from '@/types'

const LOCALE_FLAGS: Record<string, string> = {
  en: '🇺🇸', vi: '🇻🇳', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳',
  fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸', pt: '🇧🇷', th: '🇹🇭', id: '🇮🇩',
}

function ProgressBar({ percent }: { percent: number }) {
  const color =
    percent >= 80 ? 'bg-green-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="w-full bg-zinc-800 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all ${color}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export function ProjectCard({ project }: { project: ProjectWithStats }) {
  const percentColor =
    project.overall_percent >= 80
      ? 'text-green-400'
      : project.overall_percent >= 50
        ? 'text-yellow-400'
        : 'text-red-400'

  return (
    <Link href={`/${project.id}/editor`}>
      <div className="group bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-zinc-100 group-hover:text-white transition-colors">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-zinc-500 text-sm mt-0.5 line-clamp-1">{project.description}</p>
            )}
          </div>
          <span className={`text-sm font-semibold tabular-nums ${percentColor}`}>
            {project.overall_percent}%
          </span>
        </div>

        <ProgressBar percent={project.overall_percent} />

        <div className="flex items-center gap-3 mt-3">
          <div className="flex -space-x-1">
            {project.locales.slice(0, 6).map((locale) => (
              <span
                key={locale.id}
                className="text-base leading-none"
                title={`${locale.name} — ${locale.percent}%`}
              >
                {LOCALE_FLAGS[locale.code] ?? locale.code.toUpperCase()}
              </span>
            ))}
            {project.locales.length > 6 && (
              <span className="text-xs text-zinc-500 ml-1.5 self-center">
                +{project.locales.length - 6}
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
            <span>{project.key_count} keys</span>
            <span>{project.locale_count} locales</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
