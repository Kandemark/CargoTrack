import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { cn } from '@/lib/utils'
import Button from './Button'

type EmptySize = 'sm' | 'md' | 'lg'

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  description?: string
  action?: { label: string; onPress: () => void }
  size?: EmptySize
  className?: string
}

const sizeMap: Record<EmptySize, { py: string; iconSize: number; titleSize: string }> = {
  sm: { py: 'py-8', iconSize: 36, titleSize: 'text-ct-md' },
  md: { py: 'py-12', iconSize: 48, titleSize: 'text-ct-lg' },
  lg: { py: 'py-16', iconSize: 56, titleSize: 'text-ct-xl' },
}

export default function EmptyState({
  icon = 'cube-outline',
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  const s = sizeMap[size]

  return (
    <View className={cn('items-center justify-center px-6', s.py, className)}>
      <View className="w-16 h-16 rounded-full bg-ct-surface-muted dark:bg-ct-dark-surface items-center justify-center mb-ct-md">
        <Ionicons name={icon} size={s.iconSize} color="#9CA3AF" />
      </View>
      <Text
        className={cn(
          'font-heading font-bold text-ct-text-primary dark:text-ct-dark-text text-center',
          s.titleSize,
        )}
      >
        {title}
      </Text>
      {description && (
        <Text className="text-ct-base text-ct-text-muted dark:text-ct-dark-text-muted text-center mt-ct-sm max-w-[280px]">
          {description}
        </Text>
      )}
      {action && (
        <View className="mt-ct-lg">
          <Button variant="primary" size="sm" icon="add-circle-outline" onPress={action.onPress}>
            {action.label}
          </Button>
        </View>
      )}
    </View>
  )
}
