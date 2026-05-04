import { useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { View, PanResponder, Dimensions, StyleSheet, type ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { cn } from '@/lib/utils'

const { height: SCREEN_H } = Dimensions.get('window')

const SPRING = { damping: 20, stiffness: 200 }

interface BottomSheetProps {
  snapPoints: number[]
  initialSnap?: number
  children: React.ReactNode
  showHandle?: boolean
  glass?: boolean
  className?: string
  onSnapChange?: (index: number) => void
}

export interface BottomSheetHandle {
  snapTo: (index: number) => void
  currentIndex: () => number
}

const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet(
  { snapPoints, initialSnap = 0, children, showHandle = true, glass = true, className, onSnapChange },
  ref,
) {
  const sorted = [...snapPoints].sort((a, b) => a - b)
  const snapPx = sorted.map((pct) => SCREEN_H * (1 - pct))
  const lastSnap = useRef(initialSnap)
  const translateY = useSharedValue(snapPx[initialSnap])
  const minY = snapPx[sorted.length - 1]
  const maxY = snapPx[0]

  function closestSnap(y: number): number {
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < snapPx.length; i++) {
      const d = Math.abs(y - snapPx[i])
      if (d < bestDist) { bestDist = d; best = i }
    }
    return best
  }

  function snapTo(index: number) {
    const clamped = Math.max(0, Math.min(index, sorted.length - 1))
    lastSnap.current = clamped
    translateY.value = withSpring(snapPx[clamped], SPRING)
    onSnapChange?.(clamped)
  }

  useImperativeHandle(ref, () => ({
    snapTo,
    currentIndex: () => lastSnap.current,
  }), [])

  // Track scroll offset from inner lists — call this from children
  const scrollRef = useRef(0)
  const handleSetScrollOffset = useCallback((offset: number) => {
    scrollRef.current = offset
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only capture if vertical drag exceeds horizontal, and inner scroll is at top
        if (Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5) return false
        return Math.abs(gs.dy) > 4
      },
      onPanResponderMove: (_, gs) => {
        const currentY = snapPx[lastSnap.current]
        const next = Math.max(minY, Math.min(maxY, currentY + gs.dy))
        // Don't drag sheet down if inner scroll is active
        if (scrollRef.current > 0 && next < currentY) return
        translateY.value = next
      },
      onPanResponderRelease: (_, gs) => {
        const currentY = snapPx[lastSnap.current]
        // Check velocity for flick
        const projected = currentY + gs.dy + gs.vy * 0.15
        const idx = closestSnap(projected)
        snapTo(idx)
      },
    }),
  ).current

  const sheetHeight = SCREEN_H - minY

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.sheet,
          { height: sheetHeight + 60, top: SCREEN_H - sheetHeight },
          animStyle,
        ]}
        {...panResponder.panHandlers}
      >
        <View className={cn('rounded-t-ct-2xl overflow-hidden border border-white/[0.08] shadow-lg shadow-black/30 flex-1', className)}>
          {glass ? (
            <BlurView intensity={85} tint="dark" style={{ flex: 1 }}>
              <View className="flex-1 bg-ct-dark-card/80">
                {showHandle && (
                  <View className="items-center pt-3 pb-1">
                    <View className="w-10 h-1 rounded-full bg-slate-500/60" />
                  </View>
                )}
                {children}
              </View>
            </BlurView>
          ) : (
            <View className="flex-1 bg-ct-dark-card">
              {showHandle && (
                <View className="items-center pt-3 pb-1">
                  <View className="w-10 h-1 rounded-full bg-slate-500/60" />
                </View>
              )}
              {children}
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  } as ViewStyle,
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
})

export default BottomSheet
