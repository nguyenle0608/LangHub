'use client'

import { X, Eraser, CheckCircle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  cellCount: number
  canReview: boolean
  canEdit: boolean
  onDeselect: () => void
  onClearContent: () => void
  onReview: () => void
  onApprove: () => void
}

// Floating action bar for an Excel-style cell-range selection (drag across
// cells). Mirrors BulkActionBar (row selection) but operates on the selected
// cells: set them reviewed/approved, or clear their content.
export function CellActionBar({
  cellCount,
  canReview,
  canEdit,
  onDeselect,
  onClearContent,
  onReview,
  onApprove,
}: Props) {
  return (
    <div
      data-cell-actions="1"
      className="h-12 border-t border-border bg-card/95 backdrop-blur flex items-center px-4 gap-3"
    >
      <button
        onClick={onDeselect}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
        {cellCount} cell{cellCount > 1 ? 's' : ''} selected
      </button>
      <div className="flex-1" />

      {canReview && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs border-border text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 dark:hover:bg-blue-950/40"
          onClick={onReview}
        >
          <Eye className="h-3.5 w-3.5" />
          Review
        </Button>
      )}

      {canReview && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs border-border"
          onClick={onApprove}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Approve
        </Button>
      )}

      {canEdit && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs border-border text-muted-foreground hover:text-foreground"
          onClick={onClearContent}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
