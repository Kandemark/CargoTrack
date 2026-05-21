import { cn } from '@/lib/utils'

export type ShipmentStatus =
  | 'IN_TRANSIT'
  | 'DELAYED'
  | 'DELIVERED'
  | 'PENDING'
  | 'CUSTOMS'
  | 'CANCELLED'

interface StatusConfig {
  label: string
  bg: string
  text: string
  dot: string
}

const CONFIG: Record<ShipmentStatus, StatusConfig> = {
  IN_TRANSIT: {
    label: 'In Transit',
    bg:   'bg-blue-500/12 dark:bg-blue-500/15',
    text: 'text-blue-600 dark:text-blue-400',
    dot:  'bg-blue-500',
  },
  DELAYED: {
    label: 'Delayed',
    bg:   'bg-red-500/12 dark:bg-red-500/15',
    text: 'text-red-600 dark:text-red-400',
    dot:  'bg-red-500',
  },
  DELIVERED: {
    label: 'Delivered',
    bg:   'bg-emerald-500/12 dark:bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot:  'bg-emerald-500',
  },
  PENDING: {
    label: 'Pending',
    bg:   'bg-amber-500/12 dark:bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-400',
    dot:  'bg-amber-500',
  },
  CUSTOMS: {
    label: 'Customs',
    bg:   'bg-violet-500/12 dark:bg-violet-500/15',
    text: 'text-violet-600 dark:text-violet-400',
    dot:  'bg-violet-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg:   'bg-gray-500/12 dark:bg-gray-500/15',
    text: 'text-gray-500 dark:text-gray-400',
    dot:  'bg-gray-400',
  },
}

interface StatusBadgeProps {
  status: ShipmentStatus | string
  size?: 'sm' | 'md'
  className?: string
}

export default function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const cfg = CONFIG[status as ShipmentStatus] ?? {
    label: status,
    bg: 'bg-gray-500/12',
    text: 'text-gray-500',
    dot: 'bg-gray-400',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap',
        cfg.bg,
        cfg.text,
        size === 'sm'
          ? 'px-2 py-0.5 text-[11px]'
          : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      <span className={cn('rounded-full shrink-0', cfg.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {cfg.label}
    </span>
  )
}
