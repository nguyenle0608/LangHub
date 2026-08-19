'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { Button, type ButtonProps } from './button'

interface LoadingButtonProps extends Omit<ButtonProps, 'onClick'> {
  // If onClick returns a promise, the button shows a spinner and disables
  // itself until it settles. `loading` lets a parent drive the state instead —
  // needed when the trigger is a form submit, or when the same state also
  // disables other controls.
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>
  loading?: boolean
  /**
   * Content to show beside the spinner while loading, replacing `children`.
   * Omit to keep `children` ("Preview" → spinner + "Preview"); pass a string
   * for a label swap ("Deleting…"); pass null for an icon button, where the
   * spinner should stand in for the icon rather than sit next to it.
   */
  loadingText?: React.ReactNode
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ onClick, loading, disabled, children, loadingText, ...props }, ref) => {
    const noop = React.useCallback(() => {}, [])
    const { run, pending } = useAsyncAction(onClick ?? noop)
    const isLoading = pending || loading
    // undefined means "keep children"; null means "spinner only".
    const content = isLoading && loadingText !== undefined ? loadingText : children

    return (
      <Button ref={ref} onClick={run} disabled={disabled || isLoading} {...props}>
        {isLoading && <Loader2 className="animate-spin" />}
        {content}
      </Button>
    )
  }
)
LoadingButton.displayName = 'LoadingButton'
