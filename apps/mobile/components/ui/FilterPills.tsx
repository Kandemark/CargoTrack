import { View, ScrollView, TouchableOpacity, Text, type ViewProps } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'
import { T } from '@/lib/theme'

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
  style?: ViewProps['style']
}

export default function FilterPills({
  options,
  selected,
  onSelect,
  allowDeselect = true,
  style,
}: FilterPillsProps) {
  const { colors, font, radius, isDark } = useAppTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 16 }}
      style={[{ paddingVertical: 4 }, style]}
    >
      {options.map((opt) => {
        const isActive = selected === opt.key
        const hasCustomColors = !!(opt.activeBg || opt.activeText || opt.activeBorder)

        const pillBg = isActive && hasCustomColors ? opt.activeBg
          : isActive ? (isDark ? T.color.brand.accent : T.color.brand.primary)
          : colors.card

        const pillBorder = isActive && hasCustomColors ? (opt.activeBorder ?? opt.activeBg)
          : isActive ? pillBg
          : colors.border

        const textColor = isActive && hasCustomColors && opt.activeText
          ? opt.activeText
          : isActive && !hasCustomColors ? '#FFFFFF'
          : colors.textSecondary

        const countColor = isActive ? 'rgba(255,255,255,0.7)' : colors.textFaint

        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => {
              if (allowDeselect && isActive) onSelect(null)
              else onSelect(opt.key)
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: radius.full,
              borderWidth: 1,
              backgroundColor: pillBg,
              borderColor: pillBorder,
            }}
          >
            {opt.dotColor && (
              <View style={{ width: 8, height: 8, borderRadius: 4, marginRight: 6, backgroundColor: opt.dotColor }} />
            )}
            <Text style={{
              fontSize: font.size.sm,
              fontWeight: font.weight.bold,
              color: textColor,
            }}>
              {opt.label}
            </Text>
            {opt.count !== undefined && (
              <Text style={{
                fontSize: font.size.xs,
                fontWeight: font.weight.bold,
                marginLeft: 6,
                color: countColor,
              }}>
                {opt.count}
              </Text>
            )}
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

