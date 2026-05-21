import { useEffect } from 'react'
import { Text, type TextStyle, type StyleProp } from 'react-native'
import Animated, { useSharedValue, useAnimatedProps, withTiming, type SharedValue } from 'react-native-reanimated'
import { useAppTheme } from '@/lib/useAppTheme'

const AnimatedText = Animated.createAnimatedComponent(Text)

interface AnimatedNumberProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  style?: StyleProp<TextStyle>
  formatter?: (val: number) => string
}

export default function AnimatedNumber({
  value,
  duration = 800,
  prefix = '',
  suffix = '',
  decimals = 0,
  style,
  formatter,
}: AnimatedNumberProps) {
  const { colors } = useAppTheme()
  const sv = useSharedValue(0)

  useEffect(() => {
    sv.value = withTiming(value, { duration })
  }, [value, duration])

  const animatedProps = useAnimatedProps(() => {
    const display = formatter ? formatter(sv.value) : `${prefix}${sv.value.toFixed(decimals)}${suffix}`
    return { text: display } as any
  })

  return (
    <AnimatedText
      style={[{ fontVariant: ['tabular-nums'], color: colors.text }, style]}
      animatedProps={animatedProps}
    />
  )
}

// Hook version — returns the shared value for custom rendering
export function useAnimatedNumber(value: number, duration = 800): SharedValue<number> {
  const sv = useSharedValue(0)
  useEffect(() => {
    sv.value = withTiming(value, { duration })
  }, [value, duration])
  return sv
}
