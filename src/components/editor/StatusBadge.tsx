import { cn } from '@/lib/utils'

interface Props {
  status: string | null
  size?: 'sm' | 'xs'
}

const CONFIG: Record<string, { label: string; className: string }> = {
  approved: { label: 'Approved', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  reviewed: { label: 'Reviewed', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  empty: { label: 'Empty', className: 'bg-zinc-500/15 text-muted-foreground border-border' },
}

export function StatusBadge({ status, size = 'sm' }: Props) {
  const cfg = CONFIG[status ?? 'empty'] ?? CONFIG['empty']!
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border font-medium',
        size === 'xs' ? 'px-1 py-px text-[10px]' : 'px-1.5 py-0.5 text-xs',
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  )
}
