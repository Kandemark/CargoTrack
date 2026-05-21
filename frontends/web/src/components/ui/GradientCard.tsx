import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GradientCardProps {
  children: ReactNode
  accentColor?: string // Tailwind color, e.g. 'blue' | 'emerald' | 'amber' | 'red' | 'purple'
  accentPosition?: 'top' | 'left'
  hover?: boolean
  className?: string
  onClick?: () => void
}

const accentMap: Record<string, string> = {
  blue:    'from-blue-500/40 to-blue-600/40 border-blue-500/20',
  emerald: 'from-emerald-500/40 to-emerald-600/40 border-emerald-500/20',
  amber:   'from-amber-500/40 to-amber-600/40 border-amber-500/20',
  red:     'from-red-500/40 to-red-600/40 border-red-500/20',
  purple:  'from-purple-500/40 to-purple-600/40 border-purple-500/20',
  orange:  'from-orange-500/40 to-orange-600/40 border-orange-500/20',
  indigo:  'from-indigo-500/40 to-indigo-600/40 border-indigo-500/20',
}

const accentStripMap: Record<string, string> = {
  blue:    'bg-blue-500',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-500',
  red:     'bg-red-500',
  purple:  'bg-purple-500',
  orange:  'bg-orange-500',
  indigo:  'bg-indigo-500',
}

export default function GradientCard({
  children,
  accentColor,
  accentPosition = 'top',
  hover = true,
  className,
  onClick,
}: GradientCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-[#1a2235] shadow-card overflow-hidden transition-all duration-300',
        hover && 'hover:shadow-elevated hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {accentColor && accentPosition === 'top' && (
        <div className={cn('h-1 w-full bg-gradient-to-r', accentMap[accentColor] ?? accentMap.blue)} />
      )}
      {accentColor && accentPosition === 'left' && (
        <div className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-r-full', accentStripMap[accentColor] ?? accentStripMap.blue)} />
      )}
      {children}
    </div>
  )
}
