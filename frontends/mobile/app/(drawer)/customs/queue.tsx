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

function daysSince(iso: string): number {
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export default function CustomsQueueScreen() {
  const [shipments, setShipments] = useState<ShipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, spacing, status, risk } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get<{ results: ShipmentItem[] }>('/api/v1/shipments/?status=CUSTOMS')
      const data = res.data.results ?? []
      // Sort by time in customs descending (longest-waiting first)
      data.sort((a, b) => {
        const dateA = a.actual_arrival || a.scheduled_arrival
        const dateB = b.actual_arrival || b.scheduled_arrival
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      })
      setShipments(data)
    } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const totalInCustoms = shipments.length
  const awaitingClearance = shipments.filter(s => s.status === 'CUSTOMS').length
  // "Cleared today" — filter to shipments where actual_departure is today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const clearedToday = shipments.filter(s => {
    if (!s.actual_departure) return false
    const dep = new Date(s.actual_departure)
    dep.setHours(0, 0, 0, 0)
    return dep.getTime() === today.getTime()
  }).length

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Clearance Queue" backButton />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={status.customs} />
          <Text style={{ color: colors.textFaint, fontSize: font.size.base, marginTop: 12 }}>
            Loading customs queue...
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
                { label: 'In Customs', value: totalInCustoms, icon: 'globe-outline' as const, color: status.customs },
                { label: 'Awaiting', value: awaitingClearance, icon: 'time-outline' as const, color: risk.medium },
                { label: 'Cleared Today', value: clearedToday, icon: 'checkmark-circle-outline' as const, color: status.delivered },
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
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.textFaint} />
              <Text style={[s.emptyTitle, { color: colors.textMuted }]}>No shipments at customs</Text>
              <Text style={{ fontSize: font.size.sm, color: colors.textFaint, marginTop: 4 }}>
                All shipments have cleared customs
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const arrivalDate = item.actual_arrival || item.scheduled_arrival
            const days = daysSince(arrivalDate)
            const daysColor = days > 7 ? risk.high : days > 3 ? risk.medium : status.pending
            return (
              <TouchableOpacity
                onPress={() => router.push(`/shipment/${item.id}` as any)}
                activeOpacity={0.7}
                style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={s.cardRow}>
                  <View style={[s.iconBox, { backgroundColor: colors.muted }]}>
                    <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.title, { color: colors.text }]}>{item.tracking_number}</Text>
                    <Text style={[s.sub, { color: colors.textMuted }]}>
                      {item.route ? `${item.route.origin} → ${item.route.destination}` : 'Location unknown'}
                      {'  ·  '}{item.carrier_name || 'Unknown carrier'}
                    </Text>
                    <Text style={[s.dateText, { color: colors.textFaint }]}>
                      Arrived: {formatDate(arrivalDate)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <StatusBadge status={item.status} size="sm" />
                    <View style={[s.daysBadge, { backgroundColor: daysColor + '18' }]}>
                      <Ionicons name="time-outline" size={10} color={daysColor} />
                      <Text style={[s.daysText, { color: daysColor }]}>{days}d</Text>
                    </View>
                  </View>
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
  statVal: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  dateText: { fontSize: 11, marginTop: 2 },
  daysBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 6 },
  daysText: { fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 12 },
})
