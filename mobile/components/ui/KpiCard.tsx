import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { cn } from '@/lib/utils'
import Skeleton from './Skeleton'

interface KpiCardProps {
  icon: keyof typeof Ionicons.glyphMap
  iconColor?: string
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down'; value: string }
  accent?: string
  loading?: boolean
  className?: string
}

export default function KpiCard({
  icon,
  iconColor = '#0f2d5e',
  label,
  value,
  trend,
  accent,
  loading = false,
  className,
}: KpiCardProps) {
  if (loading) {
    return <Skeleton variant="card" className={cn('w-[150px] h-[112px]', className)} />
  }

  const valueStr = typeof value === 'number' ? value.toLocaleString() : value

  return (
    <View
      className={cn(
        'bg-ct-surface-card dark:bg-ct-dark-card rounded-ct-lg p-ct-lg',
        'shadow-sm',
        className,
      )}
      style={{
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {accent && (
        <View
          className="absolute top-0 left-0 right-0 h-[3px] rounded-t-ct-lg"
          style={{ backgroundColor: accent }}
        />
      )}
      <View
        className="w-10 h-10 rounded-ct-md items-center justify-center mb-ct-sm"
        style={{ backgroundColor: `${iconColor}18` }}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text
        className="text-ct-2xl font-heading font-bold text-ct-text-primary dark:text-ct-dark-text"
        numberOfLines={1}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {valueStr}
      </Text>
      <Text className="text-ct-xs text-ct-text-muted dark:text-ct-dark-text-muted mt-1" numberOfLines={1}>
        {label}
      </Text>
      {trend && (
        <View className="flex-row items-center mt-1.5">
          <Ionicons
            name={trend.direction === 'up' ? 'trending-up' : 'trending-down'}
            size={12}
            color={trend.direction === 'up' ? '#16A34A' : '#EF4444'}
          />
          <Text
            className="text-ct-xs font-bold ml-1"
            style={{ color: trend.direction === 'up' ? '#16A34A' : '#EF4444' }}
          >
            {trend.value}
          </Text>
        </View>
      )}
    </View>
  )
}
