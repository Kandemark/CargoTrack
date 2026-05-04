import { View, Text } from 'react-native'
import { riskLevel } from '@shared/utils/statusColors'
import type { CarrierPerformance } from '@shared/api/types'

export default function CarrierRow({ c }: { c: CarrierPerformance }) {
  const highRisk = c.avg_risk > 0.5

  return (
    <View
      className={`flex-row py-2 px-2.5 rounded-ct-sm mb-0.5 ${
        highRisk ? 'bg-red-50 dark:bg-red-900/20' : ''
      }`}
    >
      <Text className="flex-[2] text-ct-sm font-bold text-ct-text-primary dark:text-ct-dark-text" numberOfLines={1}>
        {c.carrier_name}
      </Text>
      <Text className="flex-1 text-ct-sm text-ct-text-muted dark:text-ct-dark-text-muted text-center">
        {c.shipment_count}
      </Text>
      <Text className="flex-1 text-ct-sm font-bold text-center" style={{ color: riskLevel(c.avg_risk).color }}>
        {Math.round(c.avg_risk * 100)}%
      </Text>
      <Text className="flex-1 text-ct-sm text-ct-text-muted dark:text-ct-dark-text-muted text-right">
        {c.on_time}
      </Text>
    </View>
  )
}
