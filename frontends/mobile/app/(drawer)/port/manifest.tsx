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

export default function PortManifestScreen() {
  const [manifests, setManifests] = useState<ShipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, status, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get<{ results: ShipmentItem[] }>('/api/v1/shipments/?page_size=50')
      setManifests(res.data.results ?? [])
    } catch { /* handled by loading state */ }
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const totalWeight = manifests.reduce((sum, m) => sum + (m.weight_kg ?? 0), 0)
  const inTransitCount = manifests.filter((m) => m.status === 'IN_TRANSIT').length
  const deliveredCount = manifests.filter((m) => m.status === 'DELIVERED').length

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Manifests" backButton />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Manifests" backButton />
      <FlatList
        data={manifests}
        keyExtractor={(m) => String(m.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: brand.primary }]}>{manifests.length}</Text>
              <Text style={[s.statLabel, { color: colors.textFaint }]}>Entries</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: status.inTransit }]}>{inTransitCount}</Text>
              <Text style={[s.statLabel, { color: colors.textFaint }]}>In Transit</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: colors.textSecondary }]}>{(totalWeight / 1000).toFixed(1)}t</Text>
              <Text style={[s.statLabel, { color: colors.textFaint }]}>Total Weight</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={48} color={colors.textFaint} />
            <Text style={[s.emptyTitle, { color: colors.textMuted }]}>No manifest entries</Text>
            <Text style={[s.emptySub, { color: colors.textFaint }]}>Cargo manifest entries will appear here when shipments are processed.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/shipment/${item.id}` as any)}
            style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {/* Table-like header row */}
            <View style={s.row}>
              <Text style={[s.colTracking, { color: colors.text }]} numberOfLines={1}>{item.tracking_number}</Text>
              <Text style={[s.colWeight, { color: colors.textMuted }]} numberOfLines={1}>{item.weight_kg.toLocaleString()} kg</Text>
              <View style={s.colStatus}>
                <StatusBadge status={item.status} label={item.status_display} size="sm" />
              </View>
            </View>
            {/* Detail row */}
            <View style={[s.detailRow, { borderTopColor: colors.border }]}>
              <Ionicons name="location-outline" size={12} color={colors.textFaint} style={{ marginTop: 1 }} />
              <Text style={[s.detailText, { color: colors.textMuted }]} numberOfLines={1}>
                {item.route ? `${item.route.origin} → ${item.route.destination}` : 'Route pending'}
              </Text>
            </View>
            <View style={s.detailRow}>
              <Ionicons name="car-outline" size={12} color={colors.textFaint} style={{ marginTop: 1 }} />
              <Text style={[s.detailText, { color: colors.textFaint }]} numberOfLines={1}>
                {item.carrier_name} · Arrival: {item.scheduled_arrival ? formatDate(item.scheduled_arrival) : '—'}
              </Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colTracking: { flex: 2, fontSize: 14, fontWeight: '700' },
  colWeight: { flex: 1, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  colStatus: { flex: 1, alignItems: 'flex-end' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  detailText: { fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 13, marginTop: 4 },
})
