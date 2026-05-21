import { useCallback } from 'react'
import { TouchableOpacity, type TouchableOpacityProps, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

interface AnimatedPressableProps extends TouchableOpacityProps {
  scaleTo?: number
  haptic?: boolean
  hapticStyle?: Haptics.ImpactFeedbackStyle
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

export default function AnimatedPressable({
  scaleTo = 0.96,
  haptic = true,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  onPressIn,
  onPressOut,
  style,
  children,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: withTiming(disabled ? 0.5 : 1, { duration: 200 }),
  }))

  const handlePressIn = useCallback(
    (e: any) => {
      'worklet'
      scale.value = withSpring(scaleTo, { damping: 15, stiffness: 400 })
      if (haptic) runOnJS(Haptics.impactAsync)(hapticStyle)
      if (onPressIn) runOnJS(onPressIn)(e)
    },
    [scaleTo, haptic, hapticStyle, onPressIn],
  )

  const handlePressOut = useCallback(
    (e: any) => {
      'worklet'
      scale.value = withSpring(1, { damping: 15, stiffness: 400 })
      if (onPressOut) runOnJS(onPressOut)(e)
    },
    [onPressOut],
  )

  return (
    <AnimatedTouchable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
      style={[animatedStyle, style as ViewStyle]}
      {...rest}
    >
      {children}
    </AnimatedTouchable>
  )
}
