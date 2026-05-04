import { View, Text } from 'react-native'
import { cn } from '@/lib/utils'

type TimelineVariant = 'completed' | 'active' | 'pending' | 'error'

interface TimelineEventProps {
  label: string
  sublabel?: string
  timestamp?: string
  variant?: TimelineVariant
  isLast?: boolean
  className?: string
}

const dotClasses: Record<TimelineVariant, string> = {
  completed: 'bg-ct-success border-ct-success',
  active: 'bg-ct-in-transit border-ct-in-transit',
  pending: 'bg-transparent border-ct-border-mid dark:border-ct-dark-border',
  error: 'bg-ct-danger border-ct-danger',
}

const lineClasses: Record<TimelineVariant, string> = {
  completed: 'bg-ct-success',
  active: 'bg-ct-border-light dark:bg-ct-dark-border',
  pending: 'bg-ct-border-light dark:bg-ct-dark-border',
  error: 'bg-ct-border-light dark:bg-ct-dark-border',
}

export default function TimelineEvent({
  label,
  sublabel,
  timestamp,
  variant = 'completed',
  isLast = false,
  className,
}: TimelineEventProps) {
  return (
    <View className={cn('flex-row', className)}>
      {/* Spine */}
      <View className="items-center mr-ct-md" style={{ width: 14 }}>
        <View
          className={cn(
            'w-3.5 h-3.5 rounded-full border-2',
            dotClasses[variant],
            variant === 'active' && 'shadow-sm',
          )}
          style={
            variant === 'active'
              ? {
                  shadowColor: '#2563EB',
                  shadowOpacity: 0.4,
                  shadowRadius: 4,
                  elevation: 3,
                }
              : undefined
          }
        />
        {!isLast && (
          <View className={cn('w-[2px] flex-1 mt-1', lineClasses[variant])} />
        )}
      </View>

      {/* Content */}
      <View className="flex-1 pb-ct-xl">
        <View className="flex-row items-center justify-between">
          <Text
            className={cn(
              'text-ct-base font-bold',
              variant === 'pending'
                ? 'text-ct-text-muted dark:text-ct-dark-text-muted'
                : 'text-ct-text-primary dark:text-ct-dark-text',
            )}
          >
            {label}
          </Text>
          {timestamp && (
            <Text className="text-ct-xs text-ct-text-faint font-mono ml-ct-sm">
              {timestamp}
            </Text>
          )}
        </View>
        {sublabel && (
          <Text className="text-ct-sm text-ct-text-secondary dark:text-ct-dark-text-muted mt-0.5">
            {sublabel}
          </Text>
        )}
      </View>
    </View>
  )
}
