'use client'

import { useState } from 'react'
import { ExportSheet } from './ExportSheet'
import type { ProjectWithStats } from '@/types'

export function ExportPageClient({ project }: { project: ProjectWithStats }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <ExportSheet
        open={open}
        project={project}
        onClose={() => {
          setOpen(false)
          // Navigate back to editor after close
          window.history.back()
        }}
      />
    </>
  )
}
