import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import { StatusBadge } from '@/components/ui'
import { formatDate } from '@shared/utils/formatters'

interface ShipmentItem {
  id: number; tracking_number: string; status: string; status_display: string
  carrier_name: string; scheduled_arrival: string; scheduled_departure: string
  actual_arrival: string | null; actual_departure: string | null
  route?: { origin: string; destination: string } | null
  weight_kg: number; delay_risk_score: number
}

function getUrgency(item: ShipmentItem, now: number): 'overdue' | 'approaching' | 'pending' {
  const dep = new Date(item.scheduled_departure).getTime()
  if (dep < now) return 'overdue'
  if (dep - now < 24 * 60 * 60 * 1000) return 'approaching'
  return 'pending'
}

export default function DispatchQueueScreen() {
  const [shipments, setShipments] = useState<ShipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, spacing, status, risk } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const [pendingRes, transitRes] = await Promise.all([
        apiClient.get<{ results: ShipmentItem[] }>('/api/v1/shipments/?status=PENDING'),
        apiClient.get<{ results: ShipmentItem[] }>('/api/v1/shipments/?status=IN_TRANSIT'),
      ])
      const pending = pendingRes.data.results ?? []
      const transit = transitRes.data.results ?? []
      // Sort: overdue first, then approaching, then pending
      const now = Date.now()
      const merged = [...pending, ...transit].sort((a, b) => {
        const ua = getUrgency(a, now)
        const ub = getUrgency(b, now)
        const order = { overdue: 0, approaching: 1, pending: 2 }
        return order[ua] - order[ub]
      })
      setShipments(merged)
    } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const now = Date.now()
  const queued = shipments.filter(s => s.status === 'PENDING').length
  const assigned = shipments.filter(s => !!s.carrier_name).length
  const inTransit = shipments.filter(s => s.status === 'IN_TRANSIT').length

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Dispatch Queue" backButton />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={status.inTransit} />
          <Text style={{ color: colors.textFaint, fontSize: font.size.base, marginTop: 12 }}>
            Loading dispatch queue...
          </Text>
        </View>
      ) : (
        <FlatList
          data={shipments}
          keyExtractor={(s) => String(s.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={s.statsRow}>
              {([
                { label: 'Queued', value: queued, icon: 'list-outline' as const, color: status.pending },
                { label: 'Assigned', value: assigned, icon: 'person-outline' as const, color: status.inTransit },
                { label: 'In Transit', value: inTransit, icon: 'map-outline' as const, color: risk.medium },
              ]).map(({ label, value, icon, color }) => (
                <View key={label} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name={icon} size={16} color={color} />
                  <Text style={[s.statVal, { color: colors.text }]}>{value}</Text>
                  <Text style={[s.statLabel, { color: colors.textFaint }]}>{label}</Text>
                </View>
              ))}
            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="git-compare-outline" size={48} color={colors.textFaint} />
              <Text style={[s.emptyTitle, { color: colors.textMuted }]}>Queue is clear</Text>
              <Text style={{ fontSize: font.size.sm, color: colors.textFaint, marginTop: 4 }}>
                No shipments pending dispatch
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const urgency = getUrgency(item, now)
            const urgencyColor = urgency === 'overdue' ? risk.high : urgency === 'approaching' ? risk.medium : status.pending
            return (
              <TouchableOpacity
                onPress={() => router.push(`/shipment/${item.id}` as any)}
                activeOpacity={0.7}
                style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: urgencyColor, borderLeftWidth: 3 }]}
              >
                <View style={s.cardRow}>
                  <View style={[s.iconBox, { backgroundColor: colors.muted }]}>
                    <Ionicons name="cube-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.title, { color: colors.text }]}>{item.tracking_number}</Text>
                    <Text style={[s.sub, { color: colors.textMuted }]}>
                      {item.route ? `${item.route.origin} → ${item.route.destination}` : 'Route not set'}
                      {'  ·  '}{item.carrier_name || 'Unassigned'}
                    </Text>
                    <Text style={[s.dateText, { color: colors.textFaint }]}>
                      Departure: {formatDate(item.scheduled_departure)}
                      {urgency === 'overdue' && ' — Overdue'}
                      {urgency === 'approaching' && ' — Soon'}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} size="sm" />
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  dateText: { fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 12 },
})
