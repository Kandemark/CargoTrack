import { View, Text, type ViewProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/lib/useAppTheme'
import Button from './Button'

type EmptySize = 'sm' | 'md' | 'lg'

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  description?: string
  action?: { label: string; onPress: () => void }
  size?: EmptySize
  style?: ViewProps['style']
}

const sizeMap: Record<EmptySize, { py: number; iconSize: number; titleSize: number }> = {
  sm: { py: 32, iconSize: 36, titleSize: 14 },
  md: { py: 48, iconSize: 48, titleSize: 16 },
  lg: { py: 64, iconSize: 56, titleSize: 20 },
}

export default function EmptyState({
  icon = 'cube-outline',
  title,
  description,
  action,
  size = 'md',
  style,
}: EmptyStateProps) {
  const { colors, font, spacing } = useAppTheme()
  const s = sizeMap[size]

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: s.py }, style]}>
      <View style={{
        width: 64,
        height: 64,
        borderRadius: 9999,
        backgroundColor: colors.muted,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
      }}>
        <Ionicons name={icon} size={s.iconSize} color="#9CA3AF" />
      </View>
      <Text style={{
        fontFamily: 'SpaceGrotesk',
        fontWeight: font.weight.bold,
        color: colors.text,
        textAlign: 'center',
        fontSize: s.titleSize,
      }}>
        {title}
      </Text>
      {description && (
        <Text style={{
          fontSize: font.size.base,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: spacing.sm,
          maxWidth: 280,
        }}>
          {description}
        </Text>
      )}
      {action && (
        <View style={{ marginTop: spacing.lg }}>
          <Button variant="primary" size="sm" icon="add-circle-outline" onPress={action.onPress}>
            {action.label}
          </Button>
        </View>
      )}
    </View>
  )
}
