import { cn } from '@/lib/utils'

interface Props {
  className?: string
  size?: number
}

/**
 * The two logo files are different artwork, not a recolour, so the theme swap
 * is done by rendering both and letting CSS pick one. Reading the theme in JS
 * instead would flash the wrong logo on first paint, and `darkMode: ['class']`
 * already puts `.dark` on <html> — including when the user's choice is
 * "system". The hidden copy is `display: none`, so it stays out of the
 * accessibility tree and the name is announced once.
 */
export function Logo({ className, size = 32 }: Props) {
  // No inline `display` — that would override the block/hidden classes below.
  const style = { height: size, width: 'auto' as const }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-icon.png?v=3"
        alt="LangHub"
        style={style}
        className={cn('block flex-shrink-0 dark:hidden', className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-icon-white.png?v=3"
        alt="LangHub"
        style={style}
        className={cn('hidden flex-shrink-0 dark:block', className)}
      />
    </>
  )
}
