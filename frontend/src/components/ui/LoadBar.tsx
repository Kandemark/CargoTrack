import { cn } from '@/lib/utils'

interface LoadBarProps {
  current: number
  max: number
  unit?: string
  label?: string
  className?: string
}

export default function LoadBar({ current, max, unit = 'kg', label = 'Load', className }: LoadBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0

  const fillColor =
    pct >= 90 ? '#EF4444'   /* red — overloaded  */
    : pct >= 70 ? '#F59E0B' /* amber — heavy     */
    : '#00C896'             /* green — normal    */

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Header row */}
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xs font-semibold" style={{ color: fillColor }}>
          {current.toLocaleString()} / {max.toLocaleString()} {unit}
        </span>
      </div>

      {/* Track */}
      <div className="h-3 rounded-full bg-muted overflow-hidden relative">
        {/* Segmented tick marks */}
        {[25, 50, 75].map((tick) => (
          <div
            key={tick}
            className="absolute top-0 bottom-0 w-px bg-background/30 z-10"
            style={{ left: `${tick}%` }}
          />
        ))}
        {/* Fill */}
        <div
          className="h-full rounded-full transition-all duration-[var(--duration-slow)]"
          style={{ width: `${pct}%`, background: fillColor }}
        />
      </div>

      {/* Percentage label */}
      <div className="flex justify-end">
        <span className="text-[11px] font-bold tabular-nums" style={{ color: fillColor }}>
          {pct}%
        </span>
      </div>
    </div>
  )
}
