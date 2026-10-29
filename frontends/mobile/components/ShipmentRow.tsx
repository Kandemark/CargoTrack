import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { formatDate } from '@shared/utils/formatters'
import type { ShipmentListItem } from '@shared/api/types'
import { useAppTheme } from '@/lib/useAppTheme'
import { useAuthStore } from '@/lib/store'
import { carrierLabel } from '@/lib/carrier'
import { StatusPill, Txt } from '@/components/ui'

/**
 * One shipment in a list: route, tracking number and carrier, arrival,
 * status, and, while it is still moving, how likely it is to be late.
 */
export default function ShipmentRow({
  item,
  last = false,
}: {
  item: ShipmentListItem
  last?: boolean
}) {
  const { colors, risk } = useAppTheme()
  const ownOrg = useAuthStore((s) => s.user?.org_name)
  const carrier = carrierLabel(item.carrier_name, ownOrg)
  const moving = item.status !== 'DELIVERED'
  const score = item.delay_risk_score ?? 0
  const riskColor = score >= 0.7 ? risk.high : score >= 0.4 ? risk.medium : risk.low
  const arrival = item.actual_arrival ?? item.scheduled_arrival

  return (
    <Pressable
      onPress={() => router.push(`/(drawer)/shipment/${item.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${item.route.origin} to ${item.route.destination}, ${item.status_display}`}
      style={({ pressed }) => ({
        paddingVertical: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderMid,
        opacity: pressed ? 0.6 : 1,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {item.route.origin} → {item.route.destination}
          </Txt>
          <Txt variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {carrier === 'Own fleet' || !item.carrier_name ? carrier : `by ${carrier}`} · {item.tracking_number}
          </Txt>
        </View>
        <StatusPill status={item.status} label={item.status_display} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={item.actual_arrival ? 'checkmark-circle-outline' : 'time-outline'} size={14} color={colors.textMuted} />
          <Txt variant="caption" tone="muted">
            {item.actual_arrival ? 'Arrived' : 'Due'} {arrival ? formatDate(arrival) : '—'}
          </Txt>
        </View>
        {moving ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border }}>
              <View style={{ width: `${Math.max(Math.round(score * 100), 2)}%`, height: 4, borderRadius: 2, backgroundColor: riskColor }} />
            </View>
            <Txt variant="caption" numberOfLines={1} style={{ flexShrink: 0, color: riskColor, fontFamily: 'DMSans-SemiBold' }}>
              {Math.round(score * 100)}% risk
            </Txt>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}
