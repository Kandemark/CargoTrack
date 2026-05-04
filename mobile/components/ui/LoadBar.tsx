import { View, Text } from 'react-native'
import { cn } from '@/lib/utils'

interface LoadBarProps {
  current: number
  max: number
  unit?: string
  label?: string
  className?: string
}

function barColor(pct: number): string {
  if (pct >= 90) return 'bg-ct-danger'
  if (pct >= 70) return 'bg-ct-risk-medium'
  return 'bg-ct-success'
}

function textColor(pct: number): string {
  if (pct >= 90) return 'text-ct-danger'
  if (pct >= 70) return 'text-ct-risk-medium'
  return 'text-ct-success'
}

export default function LoadBar({ current, max, unit = '%', label, className }: LoadBarProps) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  const clamped = Math.min(pct, 100)

  return (
    <View className={cn('w-full', className)}>
      {(label || true) && (
        <View className="flex-row justify-between mb-ct-xs">
          {label && (
            <Text className="text-ct-xs text-ct-text-muted dark:text-ct-dark-text-muted font-bold uppercase tracking-wider">
              {label}
            </Text>
          )}
          <Text className={cn('text-ct-xs font-heading font-bold', textColor(clamped))}>
            {current}/{max}{unit !== '%' ? ` ${unit}` : `${unit}`}
          </Text>
        </View>
      )}
      <View className="h-2 rounded-full bg-ct-surface-muted dark:bg-ct-dark-surface overflow-hidden">
        <View
          className={cn('h-full rounded-full', barColor(clamped))}
          style={{ width: `${clamped}%` as any }}
        />
      </View>
      {/* Tick marks */}
      <View className="flex-row justify-between mt-1 px-0.5">
        {[25, 50, 75].map((tick) => (
          <View
            key={tick}
            className={cn(
              'w-[1px] h-1.5 rounded-full',
              clamped >= tick ? 'bg-ct-border-mid dark:bg-ct-dark-border' : 'bg-ct-border-light dark:bg-white/5',
            )}
          />
        ))}
      </View>
    </View>
  )
}
