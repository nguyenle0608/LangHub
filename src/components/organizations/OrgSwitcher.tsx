'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Plus, Building2 } from 'lucide-react'
import type { OrgWithStats } from '@/types'

interface Props {
  orgs: OrgWithStats[]
  currentOrgId: string
  onSwitch: (orgId: string) => void
  onCreateNew: () => void
}

export function OrgSwitcher({ orgs, currentOrgId, onSwitch, onCreateNew }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentOrg = orgs.find((o) => o.id === currentOrgId)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-zinc-200 hover:bg-zinc-800 transition-colors max-w-[200px]"
      >
        <Building2 className="h-4 w-4 text-zinc-400 flex-shrink-0" />
        <span className="text-sm font-medium truncate">
          {currentOrg?.name ?? 'Select workspace'}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-2 py-1.5 border-b border-zinc-800">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wide font-medium">Workspaces</p>
          </div>

          <div className="py-1 max-h-64 overflow-y-auto">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  onSwitch(org.id)
                  setOpen(false)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-800 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-blue-600/20 border border-blue-600/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-blue-400 uppercase">
                    {org.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{org.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {org.project_count} project{org.project_count !== 1 ? 's' : ''}
                    {' · '}
                    {org.role}
                  </p>
                </div>
                {org.id === currentOrgId && (
                  <Check className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-zinc-800 py-1">
            <button
              onClick={() => {
                onCreateNew()
                setOpen(false)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-800 transition-colors"
            >
              <div className="w-6 h-6 rounded border border-dashed border-zinc-600 flex items-center justify-center flex-shrink-0">
                <Plus className="h-3 w-3 text-zinc-400" />
              </div>
              <span className="text-sm text-zinc-400">New workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
