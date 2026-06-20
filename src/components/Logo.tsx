import { cn } from '@/lib/utils'

interface Props {
  className?: string
  size?: number
}

export function Logo({ className, size = 32 }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-icon-white.png?v=2"
      alt="LangHub"
      style={{ height: size, width: 'auto', display: 'block' }}
      className={cn('flex-shrink-0', className)}
    />
  )
}
