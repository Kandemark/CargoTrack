import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate } from 'react-native-reanimated'
import { cn } from '@/lib/utils'

type SkeletonVariant = 'text' | 'circle' | 'rect' | 'card' | 'kpi-row' | 'kpi-glass-row' | 'alert-list' | 'timeline' | 'profile'

interface SkeletonProps {
  variant?: SkeletonVariant
  width?: number
  height?: number
  className?: string
}

function ShimmerBox({ className, width, height }: { className?: string; width?: number; height?: number }) {
  const shimmerX = useSharedValue(-200)

  useEffect(() => {
    shimmerX.value = withRepeat(withTiming(200, { duration: 1200 }), -1, false)
  }, [shimmerX])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }))

  return (
    <View
      className={cn('bg-gray-200 dark:bg-white/[0.07] rounded-ct-sm overflow-hidden', className)}
      style={[{ width, height }]}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            width: '40%',
            height: '100%',
            backgroundColor: 'rgba(255,255,255,0.15)',
          },
        ]}
      />
    </View>
  )
}

export default function Skeleton({ variant = 'rect', width, height, className }: SkeletonProps) {
  switch (variant) {
    case 'text':
      return (
        <View className={cn('gap-2', className)}>
          <ShimmerBox className="h-3 w-full" />
          <ShimmerBox className="h-3 w-3/4" />
        </View>
      )

    case 'circle':
      return <ShimmerBox className={cn('rounded-full', className)} width={width ?? 40} height={height ?? 40} />

    case 'rect':
      return <ShimmerBox className={cn('rounded-ct-md', className)} width={width} height={height} />

    case 'card':
      return (
        <View className={cn('mx-4 mb-2.5 rounded-ct-lg p-3.5 bg-ct-surface-card dark:bg-ct-dark-card', className)}>
          <View className="flex-row items-center justify-between mb-2">
            <ShimmerBox className="h-3.5 w-2/5" />
            <ShimmerBox className="h-5 w-16 rounded-full" />
          </View>
          <View className="flex-row items-center mb-2.5">
            <ShimmerBox className="h-2.5 w-32" />
            <ShimmerBox className="h-2.5 w-32 ml-2" />
          </View>
          <ShimmerBox className="h-1 w-full rounded-sm" />
        </View>
      )

    case 'kpi-row':
      return (
        <View className={cn('flex-row gap-3 px-4', className)}>
          {[1, 2, 3].map((i) => (
            <View key={i} className="flex-1 bg-ct-surface-card dark:bg-ct-dark-card rounded-ct-lg p-3 h-[100px]">
              <ShimmerBox className="h-8 w-8 rounded-full mb-2" />
              <ShimmerBox className="h-3 w-2/3 mb-1" />
              <ShimmerBox className="h-5 w-1/2" />
            </View>
          ))}
        </View>
      )

    case 'kpi-glass-row':
      return (
        <View className={cn('flex-row gap-3 px-4', className)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} className="w-[140px] h-[100px] rounded-ct-xl bg-white/[0.08] p-3">
              <ShimmerBox className="h-7 w-7 rounded-full mb-2" />
              <ShimmerBox className="h-3 w-16 mb-1" />
              <ShimmerBox className="h-5 w-12" />
            </View>
          ))}
        </View>
      )

    case 'alert-list':
      return (
        <View className={cn('gap-2.5 px-4', className)}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} className="bg-ct-surface-card dark:bg-ct-dark-card rounded-ct-lg p-3.5 border-l-4 border-gray-200 dark:border-gray-700">
              <View className="flex-row justify-between mb-2">
                <ShimmerBox className="h-3 w-20 rounded-full" />
                <ShimmerBox className="h-2.5 w-24" />
              </View>
              <ShimmerBox className="h-3.5 w-2/5 mb-1.5" />
              <ShimmerBox className="h-3 w-4/5" />
            </View>
          ))}
        </View>
      )

    case 'timeline':
      return (
        <View className={cn('gap-0', className)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} className="flex-row mb-3">
              <View className="w-8 items-center">
                <ShimmerBox className="w-7 h-7 rounded-full" />
              </View>
              <View className="flex-1 ml-2.5">
                <ShimmerBox className="h-3.5 w-1/3 mb-1" />
                <ShimmerBox className="h-2.5 w-2/3 mb-1" />
                <ShimmerBox className="h-2 w-1/4" />
              </View>
            </View>
          ))}
        </View>
      )

    case 'profile':
      return (
        <View className={cn('mx-4 rounded-ct-lg p-4 bg-ct-surface-card dark:bg-ct-dark-card flex-row items-center', className)}>
          <ShimmerBox className="w-[54px] h-[54px] rounded-ct-lg" />
          <View className="flex-1 ml-3.5">
            <ShimmerBox className="h-4 w-40 mb-1.5" />
            <ShimmerBox className="h-3 w-52 mb-1" />
            <ShimmerBox className="h-3 w-32" />
          </View>
        </View>
      )

    default:
      return <ShimmerBox className={className} width={width} height={height} />
  }
}
