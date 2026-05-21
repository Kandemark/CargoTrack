import { useEffect } from 'react'
import { View, type ViewProps, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolateColor } from 'react-native-reanimated'

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

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: gradientDuration }), -1, true)
  }, [gradientDuration])

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderLeftColor: interpolateColor(progress.value, [0, 1], [accentColor, accentColorEnd]),
  }))

  return (
    <Animated.View
      style={[
        {
          borderRadius: 12,
          borderWidth: 1,
          borderLeftWidth: 3,
          padding: 14,
          marginBottom: 10,
          backgroundColor: '#fff',
          borderColor: '#E5E7EB',
        },
        style as ViewStyle,
        animatedBorderStyle,
      ]}
      {...rest}
    >
      {children}
    </Animated.View>
  )
}

// Static accent card (no animation, just the colored left stripe)
export function AccentCard({
  accentColor = '#f5801e',
  style,
  children,
  ...rest
}: Omit<GradientCardProps, 'accentColorEnd' | 'gradientDuration'>) {
  return (
    <View
      style={[
        {
          borderRadius: 12,
          borderWidth: 1,
          borderLeftWidth: 3,
          padding: 14,
          marginBottom: 10,
          backgroundColor: '#fff',
        },
        style as ViewStyle,
        { borderLeftColor: accentColor, borderColor: '#E5E7EB' },
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}
