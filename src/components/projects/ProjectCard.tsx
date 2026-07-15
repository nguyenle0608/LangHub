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
    <div className="w-full bg-muted rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
    </div>
  )
}

export function ProjectCard({ project, canDelete }: { project: ProjectWithStats; canDelete: boolean }) {
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
    <div className="group relative bg-card border border-border rounded-xl p-5 hover:border-foreground/20 hover:bg-accent/40 transition-all">
      {/* Main clickable area */}
      <Link href={`/${project.id}/editor`} className="block">
        <div className="mb-3 pr-8">
          <h3 className="font-semibold text-foreground group-hover:text-foreground transition-colors truncate">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-muted-foreground text-sm mt-0.5 line-clamp-1">{project.description}</p>
          )}
        </div>

        <ProgressBar percent={project.overall_percent} />

        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5">
            {project.locales.slice(0, 6).map((locale) => (
              <span key={locale.id} className="text-base leading-none" title={`${locale.name} — ${locale.percent}%`}>
                {localeFlag(locale.code)}
              </span>
            ))}
            {project.locales.length > 6 && (
              <span className="text-xs text-muted-foreground self-center">+{project.locales.length - 6}</span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
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
          className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-8 z-20 w-44 bg-popover border border-border rounded-lg shadow-xl py-1 text-sm">
            {!confirmDelete ? (
              <>
                <Link
                  href={`/${project.id}/editor`}
                  className="flex items-center gap-2.5 px-3 py-2 text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open editor
                </Link>
                {canDelete && (
                  <>
                    <Link
                      href={`/${project.id}/settings`}
                      className="flex items-center gap-2.5 px-3 py-2 text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Link>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete project
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <p className="text-xs text-muted-foreground">Delete <span className="text-foreground font-medium">{project.name}</span>? This cannot be undone.</p>
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
                    className="flex-1 text-xs border border-border text-muted-foreground hover:text-foreground rounded px-2 py-1 transition-colors"
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
