import { useEffect } from 'react'
import { View, type ViewProps } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated'
import { T } from '@/lib/theme'

interface Props {
  size?: number
  style?: ViewProps['style']
}

/** Pulsing green dot indicating live/active status. */
export default function LiveDot({ size = 8, style }: Props) {
  const opacity = useSharedValue(0.4)

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true)
  }, [opacity])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: opacity.value }],
  }))

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View
        style={[{ width: size, height: size, borderRadius: 9999, backgroundColor: T.color.ui.success }, animStyle]}
      />
    </View>
  )
}
