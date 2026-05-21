import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  /** Percentage change — positive = up, negative = down, undefined = no trend */
  trend?: number
  /** Colour applied to the icon background bubble */
  iconColor?: string
  className?: string
  loading?: boolean
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  iconColor = '#00C896',
  className,
  loading = false,
}: StatCardProps) {
  const TrendIcon =
    trend === undefined ? null
    : trend > 0 ? TrendingUp
    : trend < 0 ? TrendingDown
    : Minus

  const trendColor =
    trend === undefined ? ''
    : trend > 0 ? 'text-emerald-500'
    : trend < 0 ? 'text-red-400'
    : 'text-gray-400'

  if (loading) {
    return (
      <div className={cn(
        'rounded-xl border border-border bg-card p-5 flex items-start gap-4',
        className,
      )}>
        <div className="w-10 h-10 rounded-xl skeleton shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 w-20 rounded skeleton" />
          <div className="h-6 w-28 rounded skeleton" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-5',
      'flex items-start gap-4',
      'hover:shadow-elevated transition-shadow duration-[var(--duration-base)]',
      className,
    )}>
      {/* Icon bubble */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${iconColor}18` }}
      >
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-foreground tracking-tight">
          {value}
        </p>
        {TrendIcon && trend !== undefined && (
          <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', trendColor)}>
            <TrendIcon className="w-3.5 h-3.5" />
            {Math.abs(trend)}% vs last week
          </p>
        )}
      </div>
    </div>
  )
}
