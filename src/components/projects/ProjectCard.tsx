'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Settings, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { ProjectWithStats } from '@/types'
import { localeFlag } from '@/lib/locale-flag'

function ProgressBar({ percent }: { percent: number }) {
  const color =
    percent >= 80 ? 'bg-green-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="w-full bg-zinc-800 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
    </div>
  )
}

export function ProjectCard({ project }: { project: ProjectWithStats }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const percentColor =
    project.overall_percent >= 80 ? 'text-green-400' :
    project.overall_percent >= 50 ? 'text-yellow-400' : 'text-red-400'

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setConfirmDelete(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      toast.success(`"${project.name}" deleted`)
      router.refresh()
    } else {
      toast.error('Failed to delete project')
    }
    setMenuOpen(false)
    setConfirmDelete(false)
  }

  return (
    <div className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all">
      {/* Main clickable area */}
      <Link href={`/${project.id}/editor`} className="block">
        <div className="mb-3 pr-8">
          <h3 className="font-semibold text-zinc-100 group-hover:text-white transition-colors truncate">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-zinc-500 text-sm mt-0.5 line-clamp-1">{project.description}</p>
          )}
        </div>

        <ProgressBar percent={project.overall_percent} />

        <div className="flex items-center gap-3 mt-3">
          <div className="flex -space-x-1">
            {project.locales.slice(0, 6).map((locale) => (
              <span key={locale.id} className="text-base leading-none" title={`${locale.name} — ${locale.percent}%`}>
                {localeFlag(locale.code)}
              </span>
            ))}
            {project.locales.length > 6 && (
              <span className="text-xs text-zinc-500 ml-1.5 self-center">+{project.locales.length - 6}</span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
            <span>{project.key_count} keys</span>
            <span>{project.locale_count} locales</span>
            <span className={`font-semibold tabular-nums ${percentColor}`}>{project.overall_percent}%</span>
          </div>
        </div>
      </Link>

      {/* Kebab menu */}
      <div ref={menuRef} className="absolute top-3 right-3">
        <button
          onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v); setConfirmDelete(false) }}
          className="w-7 h-7 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-8 z-20 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 text-sm">
            {!confirmDelete ? (
              <>
                <Link
                  href={`/${project.id}/editor`}
                  className="flex items-center gap-2.5 px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open editor
                </Link>
                <Link
                  href={`/${project.id}/settings`}
                  className="flex items-center gap-2.5 px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Link>
                <div className="border-t border-zinc-800 my-1" />
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete project
                </button>
              </>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <p className="text-xs text-zinc-400">Delete <span className="text-zinc-200 font-medium">{project.name}</span>? This cannot be undone.</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded px-2 py-1 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded px-2 py-1 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
