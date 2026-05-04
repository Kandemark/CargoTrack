import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GradientChartProps {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
  action?: ReactNode
  height?: number | string
}

const GRADIENT_IDS = [
  'chartGrad1', 'chartGrad2', 'chartGrad3', 'chartGrad4', 'chartGrad5',
]

export default function GradientChart({
  children,
  className,
  title,
  subtitle,
  action,
  height = 280,
}: GradientChartProps) {
  return (
    <div className={cn(
      'bg-white dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-white/8 shadow-card p-5',
      className,
    )}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-gray-800 dark:text-white font-heading">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}

      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <linearGradient id={GRADIENT_IDS[0]} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ct-navy)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--ct-navy)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={GRADIENT_IDS[1]} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={GRADIENT_IDS[2]} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={GRADIENT_IDS[3]} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={GRADIENT_IDS[4]} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
          </linearGradient>
        </defs>
      </svg>

      <div style={{ height }}>
        {children}
      </div>
    </div>
  )
}
