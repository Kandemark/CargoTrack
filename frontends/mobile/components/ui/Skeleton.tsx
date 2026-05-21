import { useEffect } from 'react'
import { View, type ViewProps } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated'
import { useAppTheme } from '@/lib/useAppTheme'

type SkeletonVariant = 'text' | 'circle' | 'rect' | 'card' | 'kpi-row' | 'kpi-glass-row' | 'alert-list' | 'timeline' | 'profile'

interface SkeletonProps {
  variant?: SkeletonVariant
  width?: number
  height?: number
  style?: ViewProps['style']
}

function ShimmerBox({ width, height, style }: { width?: number; height?: number; style?: ViewProps['style'] }) {
  const { colors, isDark } = useAppTheme()
  const shimmerX = useSharedValue(-200)

  useEffect(() => {
    shimmerX.value = withRepeat(withTiming(200, { duration: 1200 }), -1, false)
  }, [shimmerX])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }))

  return (
    <View style={[{
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#E5E7EB',
      borderRadius: 8,
      overflow: 'hidden',
      width,
      height,
    }, style]}>
      <Animated.View style={[animatedStyle, {
        width: '40%',
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.15)',
      }]} />
    </View>
  )
}

export default function Skeleton({ variant = 'rect', width, height, style }: SkeletonProps) {
  const { colors, radius, isDark } = useAppTheme()

  switch (variant) {
    case 'text':
      return (
        <View style={[{ gap: 8 }, style]}>
          <ShimmerBox height={12} style={{ width: '100%' }} />
          <ShimmerBox height={12} style={{ width: '75%' }} />
        </View>
      )

    case 'circle':
      return <ShimmerBox width={width ?? 40} height={height ?? 40} style={{ borderRadius: 9999 }} />

    case 'rect':
      return <ShimmerBox width={width} height={height} style={[{ borderRadius: radius.md }, style]} />

    case 'card':
      return (
        <View style={[{
          marginHorizontal: 16,
          marginBottom: 10,
          borderRadius: radius.lg,
          padding: 14,
          backgroundColor: colors.card,
        }, style]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <ShimmerBox height={14} style={{ width: '40%' }} />
            <ShimmerBox height={20} width={64} style={{ borderRadius: 9999 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <ShimmerBox height={10} width={128} />
            <ShimmerBox height={10} width={128} style={{ marginLeft: 8 }} />
          </View>
          <ShimmerBox height={4} style={{ width: '100%', borderRadius: 4 }} />
        </View>
      )

    case 'kpi-row':
      return (
        <View style={[{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }, style]}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 12, height: 100 }}>
              <ShimmerBox height={32} width={32} style={{ borderRadius: 9999, marginBottom: 8 }} />
              <ShimmerBox height={12} style={{ width: '66%', marginBottom: 4 }} />
              <ShimmerBox height={20} style={{ width: '50%' }} />
            </View>
          ))}
        </View>
      )

    case 'kpi-glass-row':
      return (
        <View style={[{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }, style]}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ width: 140, height: 100, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.08)', padding: 12 }}>
              <ShimmerBox height={28} width={28} style={{ borderRadius: 9999, marginBottom: 8 }} />
              <ShimmerBox height={12} width={64} style={{ marginBottom: 4 }} />
              <ShimmerBox height={20} width={48} />
            </View>
          ))}
        </View>
      )

    case 'alert-list':
      return (
        <View style={[{ gap: 10, paddingHorizontal: 16 }, style]}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{
              backgroundColor: colors.card,
              borderRadius: radius.lg,
              padding: 14,
              borderLeftWidth: 4,
              borderLeftColor: isDark ? '#374151' : '#E5E7EB',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <ShimmerBox height={12} width={80} style={{ borderRadius: 9999 }} />
                <ShimmerBox height={10} width={96} />
              </View>
              <ShimmerBox height={14} style={{ width: '40%', marginBottom: 6 }} />
              <ShimmerBox height={12} style={{ width: '80%' }} />
            </View>
          ))}
        </View>
      )

    case 'timeline':
      return (
        <View style={[{ gap: 0 }, style]}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 12 }}>
              <View style={{ width: 32, alignItems: 'center' }}>
                <ShimmerBox height={28} width={28} style={{ borderRadius: 9999 }} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <ShimmerBox height={14} style={{ width: '33%', marginBottom: 4 }} />
                <ShimmerBox height={10} style={{ width: '66%', marginBottom: 4 }} />
                <ShimmerBox height={8} style={{ width: '25%' }} />
              </View>
            </View>
          ))}
        </View>
      )

    case 'profile':
      return (
        <View style={[{
          marginHorizontal: 16,
          borderRadius: radius.lg,
          padding: 16,
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
        }, style]}>
          <ShimmerBox height={54} width={54} style={{ borderRadius: radius.lg }} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <ShimmerBox height={16} width={160} style={{ marginBottom: 6 }} />
            <ShimmerBox height={12} width={208} style={{ marginBottom: 4 }} />
            <ShimmerBox height={12} width={128} />
          </View>
        </View>
      )

    default:
      return <ShimmerBox width={width} height={height} style={style} />
  }
}
