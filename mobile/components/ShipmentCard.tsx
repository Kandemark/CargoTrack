import { memo } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { riskLevel } from '@shared/utils/statusColors'
import { formatDate } from '@shared/utils/formatters'
import { StatusBadge } from '@/components/ui'
import type { ShipmentListItem, ShipmentStatus } from '@shared/api/types'

function ShipmentCard({ item }: { item: ShipmentListItem }) {
  const origin = item.route?.origin ?? '—'
  const dest = item.route?.destination ?? '—'
  const risk = riskLevel(item.delay_risk_score ?? 0)
  const riskPct = Math.round((item.delay_risk_score ?? 0) * 100)
  const eta = item.scheduled_arrival ? formatDate(item.scheduled_arrival) : '—'

  return (
    <TouchableOpacity
      onPress={() => router.push(`/shipment/${item.id}`)}
      activeOpacity={0.8}
      className="bg-ct-surface-card dark:bg-ct-dark-card mx-4 mb-2.5 rounded-ct-lg p-ct-md shadow-sm"
    >
      {/* Tracking + status */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-ct-dark-text flex-1 mr-2" numberOfLines={1}>
          {item.tracking_number}
        </Text>
        <StatusBadge status={item.status} size="sm" />
      </View>

      {/* Route */}
      <View className="flex-row items-center mb-2.5">
        <Ionicons name="location-outline" size={11} color="#94a3b8" />
        <Text className="text-ct-xs text-ct-text-muted dark:text-ct-dark-text-muted ml-1" numberOfLines={1}>{origin}</Text>
        <Ionicons name="arrow-forward" size={10} color="#94a3b8" style={{ marginHorizontal: 4 }} />
        <Text className="text-ct-xs text-ct-text-muted dark:text-ct-dark-text-muted flex-1" numberOfLines={1}>{dest}</Text>
      </View>

      {/* Carrier + ETA */}
      <View className="flex-row items-center justify-between mb-2.5">
        <Text className="text-ct-xs text-ct-text-faint" numberOfLines={1}>{item.carrier_name}</Text>
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={11} color="#9ca3af" />
          <Text className="text-ct-xs text-ct-text-faint ml-1">ETA {eta}</Text>
        </View>
      </View>

      {/* Risk bar */}
      <View className="flex-row items-center">
        <View className="flex-1 h-[5px] bg-ct-surface-muted dark:bg-ct-dark-surface rounded-sm mr-2">
          <View className="h-[5px] rounded-sm" style={{ width: `${riskPct}%`, backgroundColor: risk.color }} />
        </View>
        <Text className="text-ct-xs font-bold w-10 text-right" style={{ color: risk.color }}>
          {riskPct}% {risk.label}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default memo(ShipmentCard)
