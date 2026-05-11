import { View, Text } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useAppTheme } from '@/lib/useAppTheme'

export default function OnTimeRing({ rate }: { rate: number }) {
  const { colors, font } = useAppTheme()
  const size = 120
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(rate, 0), 100)
  const dash = (pct / 100) * circ
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <View style={{ alignItems: 'center' }}>
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
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, letterSpacing: -0.5, color }}>
          {pct.toFixed(1)}%
        </Text>
      </View>
      <Text style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: 4 }}>
        On-Time Rate
      </Text>
    </View>
  )
}
