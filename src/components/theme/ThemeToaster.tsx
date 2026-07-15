'use client'

import { Toaster } from 'sonner'
import { useTheme } from '@/components/theme/ThemeProvider'

export function ThemeToaster() {
  const { effectiveTheme } = useTheme()
  return <Toaster theme={effectiveTheme} position="bottom-right" />
}
