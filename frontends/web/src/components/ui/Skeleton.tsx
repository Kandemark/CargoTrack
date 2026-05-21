/**
 * Skeleton.tsx — Shimmer loading placeholder with shape variants.
 *
 * Props:
 *   variant  — 'text' | 'circle' | 'rect' | 'card' | 'chart'
 *   width    — CSS width  (default '100%')
 *   height   — CSS height (default '1rem')
 *   className— additional classes
 *   count    — number of lines for 'text' variant (default 1)
 */

import { cn } from '@/lib/utils'

interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect' | 'card' | 'chart'
  width?: string
  height?: string
  className?: string
  count?: number
}

export default function Skeleton({
  variant = 'text',
  width,
  height,
  className,
  count = 1,
}: SkeletonProps) {
  const base = 'rounded bg-gray-100 dark:bg-white/8 animate-shimmer'

  const variantStyles: Record<string, string> = {
    text:   `h-4 ${base}`,
    circle: `rounded-full ${base}`,
    rect:   `rounded-lg ${base}`,
    card:   `rounded-xl border border-gray-100 dark:border-white/5 ${base}`,
    chart:  `rounded-xl ${base}`,
  }

  const style: React.CSSProperties = {}
  if (width) style.width = width
  if (height) style.height = height

  if (variant === 'circle') {
    const size = width ?? '2.5rem'
    style.width = size
    style.height = height ?? size
  }

  if (variant === 'card') {
    return (
      <div className={cn(variantStyles[variant], 'p-4 space-y-3', className)}>
        <div className="flex items-center gap-3">
          <Skeleton variant="circle" width="2.5rem" />
          <div className="flex-1 space-y-1.5">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </div>
        </div>
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="70%" />
      </div>
    )
  }

  if (variant === 'chart') {
    return (
      <div className={cn(variantStyles[variant], 'p-4 space-y-2', className)} style={style}>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="25%" height="0.75rem" />
        <div className="flex items-end gap-2 pt-2 h-32">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex-1 rounded-t bg-gray-100 dark:bg-white/8 animate-shimmer"
              style={{ height: `${20 + Math.sin(i * 0.8) * 30 + Math.random() * 50}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (count > 1 && variant === 'text') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i}
            className={cn(variantStyles[variant], className)}
            style={{ ...style, width: i === count - 1 ? '60%' : width }} />
        ))}
      </div>
    )
  }

  return <div className={cn(variantStyles[variant], className)} style={style} />
}
