import { cn } from '@/lib/utils'

type EventVariant = 'completed' | 'active' | 'pending' | 'error'

interface TimelineEventProps {
  label: string
  sublabel?: string
  timestamp?: string
  variant?: EventVariant
  isLast?: boolean
  className?: string
}

const DOT_CLASSES: Record<EventVariant, string> = {
  completed: 'bg-ct-delivered border-ct-delivered',
  active:    'bg-ct-green border-ct-green ring-4 ring-ct-green/20',
  pending:   'bg-transparent border-border',
  error:     'bg-ct-delayed border-ct-delayed',
}

const LABEL_CLASSES: Record<EventVariant, string> = {
  completed: 'text-foreground',
  active:    'text-ct-green font-semibold',
  pending:   'text-muted-foreground',
  error:     'text-ct-delayed',
}

export default function TimelineEvent({
  label,
  sublabel,
  timestamp,
  variant = 'pending',
  isLast = false,
  className,
}: TimelineEventProps) {
  return (
    <div className={cn('relative flex gap-3', className)}>
      {/* Spine */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'mt-0.5 w-3 h-3 rounded-full border-2 shrink-0 transition-all',
            DOT_CLASSES[variant],
          )}
        />
        {!isLast && (
          <div className={cn(
            'w-px flex-1 mt-1',
            variant === 'completed' ? 'bg-ct-delivered/40' : 'bg-border',
          )} />
        )}
      </div>

      {/* Content */}
      <div className={cn('pb-5', isLast && 'pb-0')}>
        <p className={cn('text-sm leading-tight', LABEL_CLASSES[variant])}>
          {label}
        </p>
        {sublabel && (
          <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
        )}
        {timestamp && (
          <p className="mt-1 text-[11px] text-muted-foreground/70 font-mono">{timestamp}</p>
        )}
      </div>
    </div>
  )
}
