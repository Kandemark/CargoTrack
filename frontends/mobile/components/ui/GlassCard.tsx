import { View, TouchableOpacity, type ViewProps } from 'react-native'
import { BlurView } from 'expo-blur'
import { useThemeStore } from '@/lib/themeStore'

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
  const resolved = useThemeStore((s) => s.resolved)
  const tint = resolved === 'dark' ? 'dark' : 'light'
  const bgColor = resolved === 'dark' ? 'rgba(10,25,41,0.85)' : 'rgba(255,255,255,0.85)'

  const content = (
    <View style={[{
      overflow: 'hidden',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      ...(variant === 'elevated' && {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }),
    }, style]}>
      <BlurView intensity={INTENSITY[variant]} tint={tint}>
        <View style={{ backgroundColor: bgColor }}>
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
