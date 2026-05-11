import { View, Text, type ViewProps } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'
import { T } from '@/lib/theme'

type TimelineVariant = 'completed' | 'active' | 'pending' | 'error'

interface TimelineEventProps {
  label: string
  sublabel?: string
  timestamp?: string
  variant?: TimelineVariant
  isLast?: boolean
  style?: ViewProps['style']
}

const dotColor: Record<TimelineVariant, string> = {
  completed: T.color.ui.success,
  active:    T.color.status.inTransit,
  pending:   'transparent',
  error:     T.color.ui.danger,
}

const dotBorder: Record<TimelineVariant, string> = {
  completed: T.color.ui.success,
  active:    T.color.status.inTransit,
  pending:   T.light.border.mid,
  error:     T.color.ui.danger,
}

const lineColor: Record<TimelineVariant, string> = {
  completed: T.color.ui.success,
  active:    '#E5E7EB',
  pending:   '#E5E7EB',
  error:     '#E5E7EB',
}

export default function TimelineEvent({
  label,
  sublabel,
  timestamp,
  variant = 'completed',
  isLast = false,
  style,
}: TimelineEventProps) {
  const { colors, font } = useAppTheme()

  const labelColor = variant === 'pending' ? colors.textMuted : colors.text

  return (
    <View style={[{ flexDirection: 'row' }, style]}>
      <View style={{ alignItems: 'center', marginRight: 12, width: 14 }}>
        <View style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: 2,
          backgroundColor: dotColor[variant],
          borderColor: variant === 'pending' ? colors.borderMid : dotBorder[variant],
          ...(variant === 'active' ? {
            shadowColor: '#2563EB',
            shadowOpacity: 0.4,
            shadowRadius: 4,
            elevation: 3,
          } : {}),
        }} />
        {!isLast && (
          <View style={{
            width: 2,
            flex: 1,
            marginTop: 4,
            backgroundColor: variant === 'pending' ? colors.border : lineColor[variant],
          }} />
        )}
      </View>
      <View style={{ flex: 1, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{
            fontSize: font.size.base,
            fontWeight: font.weight.bold,
            color: labelColor,
          }}>
            {label}
          </Text>
          {timestamp && (
            <Text style={{
              fontSize: font.size.xs,
              color: colors.textFaint,
              fontFamily: 'monospace',
              marginLeft: 8,
            }}>
              {timestamp}
            </Text>
          )}
        </View>
        {sublabel && (
          <Text style={{
            fontSize: font.size.sm,
            color: colors.textMuted,
            marginTop: 2,
          }}>
            {sublabel}
          </Text>
        )}
      </View>
    </View>
  )
}
