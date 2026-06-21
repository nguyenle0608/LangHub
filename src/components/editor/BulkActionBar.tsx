'use client'

import { useState } from 'react'
import { X, Trash2, CheckCircle, Eye, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'

interface Props {
  selectedCount: number
  projectId: string
  canReview: boolean
  canDelete: boolean
  onClear: () => void
  onDelete: () => void | Promise<void>
  onReview: () => void | Promise<void>
  onApprove: () => void | Promise<void>
}

export function BulkActionBar({ selectedCount, projectId, canReview, canDelete, onClear, onDelete, onReview, onApprove }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    // Auto-snapshot before bulk delete
    setSnapshotting(true)
    try {
      const resp = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name: `Auto: Before deleting ${selectedCount} key${selectedCount > 1 ? 's' : ''}`,
          tag: 'auto_bulk_delete',
        }),
      })
      if (!resp.ok) {
        toast.error('Failed to create snapshot before delete')
        setSnapshotting(false)
        return
      }
    } catch {
      toast.error('Snapshot failed — delete cancelled')
      setSnapshotting(false)
      return
    }
    try {
      await onDelete()
    } finally {
      setSnapshotting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="h-12 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur flex items-center px-4 gap-3">
      <button
        onClick={() => { onClear(); setConfirmDelete(false) }}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
      >
        <X className="h-4 w-4" />
        {selectedCount} selected
      </button>
      <div className="flex-1" />

      {confirmDelete && (
        <div className="flex items-center gap-1.5 text-xs text-yellow-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          A snapshot will be created first. Confirm?
        </div>
      )}

      {canReview && (
        <LoadingButton
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs border-zinc-700 text-blue-400 hover:text-blue-300 hover:bg-blue-950/40"
          onClick={onReview}
          disabled={confirmDelete}
        >
          <Eye className="h-3.5 w-3.5" />
          Review all
        </LoadingButton>
      )}

      {canReview && (
        <LoadingButton
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs border-zinc-700"
          onClick={onApprove}
          disabled={confirmDelete}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Approve all
        </LoadingButton>
      )}

      {canDelete && (confirmDelete ? (
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-zinc-700"
            onClick={() => setConfirmDelete(false)}
            disabled={snapshotting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs bg-red-600 hover:bg-red-700"
            onClick={handleDelete}
            disabled={snapshotting}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {snapshotting ? 'Snapshotting…' : 'Snapshot & Delete'}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs border-red-900 text-red-400 hover:bg-red-950 hover:text-red-300"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      ))}
    </div>
  )
}
