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

export default function WarehouseOutboundScreen() {
  const [shipments, setShipments] = useState<ShipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, status, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get<{ results: ShipmentItem[] }>('/api/v1/shipments/?status=PENDING')
      setShipments(res.data.results ?? [])
    } catch { /* handled by loading state */ }
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const today = new Date()
  const todayStr = today.toDateString()
  const scheduledToday = shipments.filter((s) => {
    if (!s.scheduled_departure) return false
    return new Date(s.scheduled_departure).toDateString() === todayStr
  }).length

  const totalWeight = shipments.reduce((sum, s) => sum + (s.weight_kg ?? 0), 0)

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Outbound" backButton />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Outbound" backButton />
      <FlatList
        data={shipments}
        keyExtractor={(s) => String(s.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: brand.primary }]}>{shipments.length}</Text>
              <Text style={[s.statLabel, { color: colors.textFaint }]}>Pending</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: status.inTransit }]}>{scheduledToday}</Text>
              <Text style={[s.statLabel, { color: colors.textFaint }]}>Scheduled Today</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: colors.textSecondary }]}>{(totalWeight / 1000).toFixed(1)}t</Text>
              <Text style={[s.statLabel, { color: colors.textFaint }]}>Total Weight</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="arrow-forward-outline" size={48} color={colors.textFaint} />
            <Text style={[s.emptyTitle, { color: colors.textMuted }]}>No outbound shipments</Text>
            <Text style={[s.emptySub, { color: colors.textFaint }]}>Pending dispatch shipments will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/shipment/${item.id}` as any)}
            style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={s.cardRow}>
              <View style={[s.iconBox, { backgroundColor: colors.muted }]}>
                <Ionicons name="arrow-forward-outline" size={20} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: colors.text }]}>{item.tracking_number}</Text>
                <Text style={[s.subtitle, { color: colors.textMuted }]}>
                  {item.route ? `${item.route.origin} → ${item.route.destination}` : 'Outbound dispatch'}
                </Text>
                <Text style={[s.meta, { color: colors.textFaint }]}>
                  {item.carrier_name} · {item.weight_kg.toLocaleString()} kg · Departure: {item.scheduled_departure ? formatDate(item.scheduled_departure) : '—'}
                </Text>
              </View>
              <View style={s.badgeWrap}>
                <StatusBadge status={item.status} label={item.status_display} size="sm" />
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  meta: { fontSize: 11, marginTop: 2 },
  badgeWrap: { alignSelf: 'flex-start' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 13, marginTop: 4 },
})
