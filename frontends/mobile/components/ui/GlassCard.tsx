import { View, TouchableOpacity, type ViewProps } from 'react-native'
import { BlurView } from 'expo-blur'
import { useAppTheme } from '@/lib/useAppTheme'

type GlassVariant = 'default' | 'elevated' | 'subtle'

interface GlassCardProps {
  variant?: GlassVariant
  accentColor?: string
  accentPosition?: 'top' | 'left'
  children: React.ReactNode
  style?: ViewProps['style']
  onPress?: () => void
}

const INTENSITY: Record<GlassVariant, number> = { default: 80, elevated: 60, subtle: 40 }

export default function GlassCard({
  variant = 'default',
  accentColor,
  accentPosition = 'top',
  children,
  style,
  onPress,
}: GlassCardProps) {
  const { colors, isDark } = useAppTheme()
  const tint = isDark ? 'dark' : 'light'

  const content = (
    <View style={[{
      overflow: 'hidden',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      ...(variant === 'elevated' && {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }),
    }, style]}>
      <BlurView intensity={INTENSITY[variant]} tint={tint}>
        <View style={{ backgroundColor: colors.glassCard }}>
          {accentColor && accentPosition === 'top' && (
            <View style={{ height: 3, width: '100%', backgroundColor: accentColor }} />
          )}
          {accentColor && accentPosition === 'left' && (
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accentColor }} />
          )}
          {children}
        </View>
      </BlurView>
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    )
  }

  return content
}
