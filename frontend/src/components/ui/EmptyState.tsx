import { type ElementType } from 'react'
import { Package, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: ElementType
  }
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-16',
}

export default function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-4', sizeClasses[size], className)}>
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-gray-300 dark:text-white/15" />
      </div>
      <h3 className="text-sm font-semibold text-gray-600 dark:text-white/40 font-heading">{title}</h3>
      {description && (
        <p className="text-xs text-gray-400 dark:text-white/25 mt-1 max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--ct-navy)' }}
        >
          {action.icon && <action.icon className="w-4 h-4" />}
          {action.label}
        </button>
      )}
    </div>
  )
}
