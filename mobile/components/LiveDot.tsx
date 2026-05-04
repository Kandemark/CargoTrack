import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated'

interface Props {
  size?: number
  className?: string
}

/** Pulsing green dot indicating live/active status. */
export default function LiveDot({ size = 8, className }: Props) {
  const opacity = useSharedValue(0.4)

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true)
  }, [opacity])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: opacity.value }],
  }))

  return (
    <View className={className} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        className="bg-ct-success rounded-full"
        style={[{ width: size, height: size }, animStyle]}
      />
    </View>
  )
}
