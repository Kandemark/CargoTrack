import { View, ScrollView, TouchableOpacity, Text } from 'react-native'
import { cn } from '@/lib/utils'

export interface FilterPill {
  key: string
  label: string
  count?: number
  dotColor?: string
  activeBg?: string
  activeText?: string
  activeBorder?: string
}

interface FilterPillsProps {
  options: FilterPill[]
  selected: string | null
  onSelect: (key: string | null) => void
  allowDeselect?: boolean
  className?: string
}

export default function FilterPills({
  options,
  selected,
  onSelect,
  allowDeselect = true,
  className,
}: FilterPillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 16 }}
      className={cn('py-1', className)}
    >
      {options.map((opt) => {
        const isActive = selected === opt.key
        const hasCustomColors = !!(opt.activeBg || opt.activeText || opt.activeBorder)

        const activeStyle = hasCustomColors && isActive
          ? {
              backgroundColor: opt.activeBg,
              borderColor: opt.activeBorder ?? opt.activeBg,
            }
          : undefined

        const activeTextStyle = hasCustomColors && isActive && opt.activeText
          ? { color: opt.activeText }
          : undefined

        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => {
              if (allowDeselect && isActive) {
                onSelect(null)
              } else {
                onSelect(opt.key)
              }
            }}
            activeOpacity={0.7}
            style={activeStyle}
            className={cn(
              'flex-row items-center px-3.5 py-2 rounded-full border',
              isActive && !hasCustomColors
                ? 'bg-ct-navy dark:bg-ct-orange border-ct-navy dark:border-ct-orange'
                : isActive
                  ? '' // custom colors applied via style
                  : 'bg-ct-surface-card dark:bg-ct-dark-card border-ct-border-light dark:border-ct-dark-border',
            )}
          >
            {opt.dotColor && (
              <View className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: opt.dotColor }} />
            )}
            <Text
              style={activeTextStyle}
              className={cn(
                'text-ct-sm font-bold',
                isActive && !hasCustomColors
                  ? 'text-white'
                  : isActive && hasCustomColors
                    ? '' // custom text applied via style
                    : 'text-ct-text-secondary dark:text-ct-dark-text-muted',
              )}
            >
              {opt.label}
            </Text>
            {opt.count !== undefined && (
              <Text
                className={cn(
                  'text-ct-xs font-bold ml-1.5',
                  isActive ? 'text-white/70' : 'text-ct-text-faint',
                )}
              >
                {opt.count}
              </Text>
            )}
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}
