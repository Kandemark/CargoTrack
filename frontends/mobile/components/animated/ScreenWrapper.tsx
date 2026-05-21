import { useEffect, useRef } from 'react'
import { View, type ViewProps } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'

type EntranceType = 'fade' | 'slide-up' | 'slide-right' | 'none'

interface ScreenWrapperProps extends ViewProps {
  entrance?: EntranceType
  duration?: number
  delay?: number
  children: React.ReactNode
}

export default function ScreenWrapper({
  entrance = 'fade',
  duration = 350,
  delay = 0,
  style,
  children,
  ...rest
}: ScreenWrapperProps) {
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(entrance === 'slide-up' ? 30 : 0)
  const translateX = useSharedValue(entrance === 'slide-right' ? 30 : 0)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (hasAnimated.current) return
    hasAnimated.current = true

    const config = { duration }

    if (entrance === 'none') {
      opacity.value = 1
      translateY.value = 0
      translateX.value = 0
      return
    }

    setTimeout(() => {
      opacity.value = withTiming(1, config)
      if (entrance === 'slide-up') translateY.value = withTiming(0, config)
      if (entrance === 'slide-right') translateX.value = withTiming(0, config)
    }, delay)
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
  }))

  return (
    <Animated.View style={[{ flex: 1 }, style, animatedStyle]} {...rest}>
      {children}
    </Animated.View>
  )
}
