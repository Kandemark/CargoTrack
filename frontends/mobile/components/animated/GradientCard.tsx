import { useEffect } from 'react'
import { View, type ViewProps, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolateColor } from 'react-native-reanimated'
import { useAppTheme } from '@/lib/useAppTheme'

interface GradientCardProps extends ViewProps {
  accentColor?: string
  accentColorEnd?: string
  gradientDuration?: number
  style?: ViewStyle
  children: React.ReactNode
}

export default function GradientCard({
  accentColor = '#f5801e',
  accentColorEnd = '#ef4444',
  gradientDuration = 3000,
  style,
  children,
  ...rest
}: GradientCardProps) {
  const progress = useSharedValue(0)
  const { isDark } = useAppTheme()

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: gradientDuration }), -1, true)
  }, [gradientDuration])

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderLeftColor: interpolateColor(progress.value, [0, 1], [accentColor, accentColorEnd]),
  }))

  const bg = isDark ? '#0a1929' : '#fff'
  const border = isDark ? '#1e3a5f' : '#E5E7EB'

  return (
    <Animated.View
      style={[
        { borderRadius: 12, borderWidth: 1, borderLeftWidth: 3, padding: 14, marginBottom: 10, backgroundColor: bg, borderColor: border },
        style as ViewStyle,
        animatedBorderStyle,
      ]}
      {...rest}
    >
      {children}
    </Animated.View>
  )
}

export function AccentCard({
  accentColor = '#f5801e',
  style,
  children,
  ...rest
}: Omit<GradientCardProps, 'accentColorEnd' | 'gradientDuration'>) {
  const { isDark } = useAppTheme()
  const bg = isDark ? '#0a1929' : '#fff'
  const border = isDark ? '#1e3a5f' : '#E5E7EB'

  return (
    <View
      style={[
        { borderRadius: 12, borderWidth: 1, borderLeftWidth: 3, padding: 14, marginBottom: 10, backgroundColor: bg, borderColor: border },
        style as ViewStyle,
        { borderLeftColor: accentColor },
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}
