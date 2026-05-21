import { useEffect } from 'react'
import { View, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated'

interface SkeletonLoaderProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export default function SkeletonLoader({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonLoaderProps) {
  const shimmerX = useSharedValue(-200)

  useEffect(() => {
    shimmerX.value = withRepeat(withTiming(200, { duration: 1200 }), -1, false)
  }, [shimmerX])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }))

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: '#E5E7EB',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          shimmerStyle,
          {
            width: '40%',
            height: '100%',
            backgroundColor: 'rgba(255,255,255,0.3)',
          },
        ]}
      />
    </View>
  )
}

// Pre-composed skeleton patterns for common use cases

export function SkeletonKpiGrid({ count = 6 }: { count?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: '31%',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            padding: 12,
            alignItems: 'center',
            gap: 6,
          }}
        >
          <SkeletonLoader width={32} height={32} borderRadius={16} />
          <SkeletonLoader width={48} height={20} />
          <SkeletonLoader width={64} height={9} borderRadius={4} />
        </View>
      ))}
    </View>
  )
}

export function SkeletonCardList({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            padding: 14,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <SkeletonLoader width="45%" height={14} />
            <SkeletonLoader width={60} height={20} borderRadius={10} />
          </View>
          <SkeletonLoader width="65%" height={10} borderRadius={4} />
          <SkeletonLoader width="40%" height={10} borderRadius={4} />
        </View>
      ))}
    </View>
  )
}

export function SkeletonProfile() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
      <SkeletonLoader width={54} height={54} borderRadius={14} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonLoader width={140} height={16} />
        <SkeletonLoader width={200} height={12} />
        <SkeletonLoader width={120} height={12} />
      </View>
    </View>
  )
}
