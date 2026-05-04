import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { riskLevel } from '@shared/utils/statusColors'

interface RiskRowProps {
  id: number
  trackingNumber: string
  score: number
}

export default function RiskRow({ id, trackingNumber, score }: RiskRowProps) {
  const risk = riskLevel(score)
  const pct = Math.round(score * 100)

  return (
    <TouchableOpacity
      onPress={() => router.push(`/shipment/${id}`)}
      className="flex-row items-center mb-2.5"
      activeOpacity={0.7}
    >
      <Text className="w-[110px] text-ct-xs text-ct-text-secondary dark:text-ct-dark-text-muted tabular-nums" numberOfLines={1}>
        {trackingNumber}
      </Text>
      <View className="flex-1 h-1.5 bg-ct-surface-muted dark:bg-ct-dark-surface rounded-sm mx-2">
        <View
          className="h-1.5 rounded-sm"
          style={{ width: `${pct}%`, backgroundColor: risk.color }}
        />
      </View>
      <Text className="w-[34px] text-right text-ct-xs font-bold" style={{ color: risk.color }}>
        {pct}%
      </Text>
    </TouchableOpacity>
  )
}
