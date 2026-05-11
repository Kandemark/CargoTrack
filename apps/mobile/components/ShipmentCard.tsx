import { memo } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { riskLevel } from '@shared/utils/statusColors'
import { formatDate } from '@shared/utils/formatters'
import { StatusBadge } from '@/components/ui'
import { useAppTheme } from '@/lib/useAppTheme'
import type { ShipmentListItem, ShipmentStatus } from '@shared/api/types'

function ShipmentCard({ item }: { item: ShipmentListItem }) {
  const { colors, font } = useAppTheme()
  const origin = item.route?.origin ?? '—'
  const dest = item.route?.destination ?? '—'
  const risk = riskLevel(item.delay_risk_score ?? 0)
  const riskPct = Math.round((item.delay_risk_score ?? 0) * 100)
  const eta = item.scheduled_arrival ? formatDate(item.scheduled_arrival) : '—'

  return (
    <TouchableOpacity
      onPress={() => router.push(`/shipment/${item.id}`)}
      activeOpacity={0.8}
      style={{
        backgroundColor: colors.card,
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text, flex: 1, marginRight: 8 }} numberOfLines={1}>
          {item.tracking_number}
        </Text>
        <StatusBadge status={item.status} size="sm" />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Ionicons name="location-outline" size={11} color="#94a3b8" />
        <Text style={{ fontSize: font.size.xs, color: colors.textMuted, marginLeft: 4 }} numberOfLines={1}>{origin}</Text>
        <Ionicons name="arrow-forward" size={10} color="#94a3b8" style={{ marginHorizontal: 4 }} />
        <Text style={{ fontSize: font.size.xs, color: colors.textMuted, flex: 1 }} numberOfLines={1}>{dest}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: font.size.xs, color: colors.textFaint }} numberOfLines={1}>{item.carrier_name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={11} color="#9ca3af" />
          <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginLeft: 4 }}>ETA {eta}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, height: 5, backgroundColor: colors.muted, borderRadius: 4, marginRight: 8 }}>
          <View style={{ height: 5, borderRadius: 4, width: `${riskPct}%`, backgroundColor: risk.color }} />
        </View>
        <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, width: 40, textAlign: 'right', color: risk.color }}>
          {riskPct}% {risk.label}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default memo(ShipmentCard)
