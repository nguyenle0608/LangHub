'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button, type ButtonProps } from './button'

interface LoadingButtonProps extends Omit<ButtonProps, 'onClick'> {
  // If onClick returns a promise, the button shows a spinner and disables
  // itself until it settles. `loading` lets a parent drive the state instead.
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>
  loading?: boolean
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ onClick, loading, disabled, children, ...props }, ref) => {
    const [busy, setBusy] = React.useState(false)
    const mounted = React.useRef(true)
    React.useEffect(() => () => { mounted.current = false }, [])

    const isLoading = busy || loading

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!onClick || busy) return
      const result = onClick(e)
      if (result instanceof Promise) {
        setBusy(true)
        result.finally(() => { if (mounted.current) setBusy(false) })
      }
    }

    return (
      <Button ref={ref} onClick={handleClick} disabled={disabled || isLoading} {...props}>
        {isLoading && <Loader2 className="animate-spin" />}
        {children}
      </Button>
    )
  }
)
LoadingButton.displayName = 'LoadingButton'
