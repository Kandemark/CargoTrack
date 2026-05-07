import { View, Text } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

export default function OnTimeRing({ rate }: { rate: number }) {
  const size = 120
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(rate, 0), 100)
  const dash = (pct / 100) * circ
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <View className="items-center">
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-ct-2xl font-extrabold tracking-tight" style={{ color }}>
          {pct.toFixed(1)}%
        </Text>
      </View>
      <Text className="text-ct-xs text-ct-text-muted dark:text-ct-dark-text-muted mt-1">On-Time Rate</Text>
    </View>
  )
}
