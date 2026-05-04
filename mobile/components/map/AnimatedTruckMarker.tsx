import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Rect, Circle } from 'react-native-svg'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate } from 'react-native-reanimated'
import type { ShipmentStatus } from '@shared/api/types'

const STATUS_COLOR: Partial<Record<ShipmentStatus, string>> = {
  IN_TRANSIT: '#2563EB',
  CUSTOMS:    '#F59E0B',
  DELAYED:    '#EF4444',
  DELIVERED:  '#16A34A',
  PENDING:    '#94A3B8',
}

interface Props {
  status: ShipmentStatus
  riskScore?: number
  size?: number
}

/** SVG truck shape color-coded by status, with animated pulsing ring.
 *  Designed to be rendered inside MapLibreGL.PointAnnotation. */
export default function AnimatedTruckMarker({ status, riskScore = 0, size = 36 }: Props) {
  const pulse = useSharedValue(1)

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.7, { duration: 1600 }), -1, true)
  }, [pulse])

  const highRisk = riskScore >= 0.7
  const color = STATUS_COLOR[status] ?? '#94a3b8'
  const ringColor = highRisk ? '#EF4444' : color

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.7], [0.55, 0]),
  }))

  const glowPulse = useSharedValue(1)
  useEffect(() => {
    if (highRisk) {
      glowPulse.value = withRepeat(withTiming(0.6, { duration: 800 }), -1, true)
    }
  }, [glowPulse, highRisk])

  const glowStyle = useAnimatedStyle(() => ({
    opacity: highRisk ? interpolate(glowPulse.value, [0.6, 1], [0.3, 0.7]) : 0,
  }))

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={[styles.ring, { borderColor: ringColor }, ringStyle]} />
      {highRisk && (
        <Animated.View style={[styles.riskGlow, { backgroundColor: 'rgba(239,68,68,0.15)' }, glowStyle]} />
      )}
      <Svg width={size} height={size} viewBox="0 0 36 36">
        {/* Wheels */}
        <Circle cx={9} cy={28} r={3.5} fill="#1e293b" />
        <Circle cx={27} cy={28} r={3.5} fill="#1e293b" />
        <Circle cx={9} cy={28} r={1.8} fill="#64748b" />
        <Circle cx={27} cy={28} r={1.8} fill="#64748b" />
        {/* Cargo body */}
        <Rect x={5} y={12} width={14} height={11} rx={2} fill={color} opacity={0.9} />
        {/* Cab */}
        <Rect x={19} y={6} width={10} height={17} rx={2} fill={color} />
        {/* Windshield */}
        <Rect x={27} y={9} width={4} height={5} rx={1} fill="#0a1929" opacity={0.5} />
        {/* Headlights */}
        <Rect x={30} y={21} width={3} height={2.5} rx={0.5} fill="#fef08a" />
        {/* Cargo lines */}
        <Rect x={8} y={15} width={8} height={1} rx={0.5} fill="rgba(255,255,255,0.3)" />
        <Rect x={8} y={18} width={6} height={1} rx={0.5} fill="rgba(255,255,255,0.3)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 2,
  },
  riskGlow: {
    position: 'absolute',
    width: '130%',
    height: '130%',
    borderRadius: 999,
  },
})
