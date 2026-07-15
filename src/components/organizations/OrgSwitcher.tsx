'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Plus, Building2, Settings, Loader2 } from 'lucide-react'
import type { OrgWithStats } from '@/types'

interface Props {
  orgs: OrgWithStats[]
  currentOrgId: string
  canManageOrg: boolean
  onSwitch: (orgId: string) => void
  onCreateNew: () => void
  switchingToId?: string | null
}

export function OrgSwitcher({ orgs, currentOrgId, canManageOrg, onSwitch, onCreateNew, switchingToId }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isSwitching = !!switchingToId

  const currentOrg = orgs.find((o) => o.id === currentOrgId)

  useEffect(() => {
    if (isSwitching) setOpen(false)
  }, [isSwitching])

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
        onClick={() => { if (!isSwitching) setOpen((v) => !v) }}
        disabled={isSwitching}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-foreground hover:bg-accent transition-colors max-w-[200px] disabled:opacity-70 disabled:cursor-default"
      >
        {isSwitching
          ? <Loader2 className="h-4 w-4 text-muted-foreground flex-shrink-0 animate-spin" />
          : <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
        <span className="text-sm font-medium truncate">
          {isSwitching
            ? (orgs.find((o) => o.id === switchingToId)?.name ?? currentOrg?.name ?? 'Loading…')
            : (currentOrg?.name ?? 'Select workspace')}
        </span>
        {!isSwitching && <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-2 py-1.5 border-b border-border">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Workspaces</p>
          </div>

          <div className="py-1 max-h-64 overflow-y-auto">
            {orgs.map((org) => {
              const isThisSwitching = switchingToId === org.id
              return (
                <button
                  key={org.id}
                  onClick={() => {
                    if (isSwitching) return
                    onSwitch(org.id)
                    setOpen(false)
                  }}
                  disabled={isSwitching}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors disabled:cursor-default"
                >
                  <div className="w-6 h-6 rounded bg-blue-600/20 border border-blue-600/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-blue-400 uppercase">
                      {org.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-popover-foreground truncate">{org.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {org.project_count} project{org.project_count !== 1 ? 's' : ''}
                      {' · '}
                      {org.role}
                    </p>
                  </div>
                  {isThisSwitching
                    ? <Loader2 className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 animate-spin" />
                    : org.id === currentOrgId && <Check className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
                </button>
              )
            })}
          </div>

          <div className="border-t border-border py-1">
            {canManageOrg && currentOrgId && (
              <a
                href={`/orgs/${currentOrgId}/settings`}
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors"
              >
                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Settings className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Workspace settings</span>
              </a>
            )}
            <button
              onClick={() => {
                onCreateNew()
                setOpen(false)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors"
            >
              <div className="w-6 h-6 rounded border border-dashed border-border flex items-center justify-center flex-shrink-0">
                <Plus className="h-3 w-3 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">New workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
