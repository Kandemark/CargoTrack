import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { riskLevel } from '@shared/utils/statusColors'
import { useAppTheme } from '@/lib/useAppTheme'

interface RiskRowProps {
  id: number
  trackingNumber: string
  score: number
}

export default function RiskRow({ id, trackingNumber, score }: RiskRowProps) {
  const { colors, font } = useAppTheme()
  const risk = riskLevel(score)
  const pct = Math.round(score * 100)

  return (
    <TouchableOpacity
      onPress={() => router.push(`/shipment/${id}`)}
      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
      activeOpacity={0.7}
    >
      <Text
        style={{ width: 110, fontSize: font.size.xs, color: colors.textSecondary, fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
      >
        {trackingNumber}
      </Text>
      <View style={{ flex: 1, height: 6, backgroundColor: colors.muted, borderRadius: 4, marginHorizontal: 8 }}>
        <View style={{ height: 6, borderRadius: 4, width: `${pct}%`, backgroundColor: risk.color }} />
      </View>
      <Text style={{ width: 34, textAlign: 'right', fontSize: font.size.xs, fontWeight: font.weight.bold, color: risk.color }}>
        {pct}%
      </Text>
    </TouchableOpacity>
  )
}
