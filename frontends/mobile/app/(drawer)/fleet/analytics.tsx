import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface TruckSummary { id: number; fleet_id: string; plate: string; make: string; model: string; status: string; status_display: string; payload_tonnes: number; mileage_km: number }

interface FleetStats {
  total_trucks: number; active_trucks: number; idle_trucks: number; maintenance_trucks: number
  total_drivers: number; available_drivers: number; on_route_drivers: number
  avg_payload_tonnes: number; total_mileage_km: number
  fleet_utilization_pct?: number; avg_driver_rating?: number
}

export default function FleetAnalyticsScreen() {
  const [stats, setStats] = useState<FleetStats | null>(null)
  const [trucks, setTrucks] = useState<TruckSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, status, radius, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, trucksRes] = await Promise.all([
        apiClient.get<FleetStats>('/api/v1/fleet/stats/'),
        apiClient.get<TruckSummary[]>('/api/v1/fleet/trucks/'),
      ])
      setStats(statsRes.data)
      setTrucks(trucksRes.data)
    } catch { /* handled by loading */ }
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const byStatus: Record<string, TruckSummary[]> = {}
  for (const t of trucks) {
    (byStatus[t.status] ??= []).push(t)
  }

  const statusLabels: Record<string, string> = { ACTIVE: 'Active', IDLE: 'Idle', MAINTENANCE: 'Maintenance', OFF_DUTY: 'Off Duty', DECOMMISSIONED: 'Decommissioned' }
  const statusColors: Record<string, string> = { ACTIVE: '#16a34a', IDLE: '#eab308', MAINTENANCE: '#f5801e', OFF_DUTY: '#64748b', DECOMMISSIONED: '#ef4444' }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Fleet Analytics" backButton />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      >
        {stats ? (
          <>
            {/* KPI Grid */}
            <View style={s.kpiGrid}>
              <View style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="car-outline" size={18} color={brand.primary} />
                <Text style={[s.kpiValue, { color: colors.text }]}>{stats.total_trucks}</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Total Trucks</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="speedometer-outline" size={18} color={'#16a34a'} />
                <Text style={[s.kpiValue, { color: colors.text }]}>{stats.fleet_utilization_pct ?? '-'}%</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Utilization</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="people-outline" size={18} color="#2563eb" />
                <Text style={[s.kpiValue, { color: colors.text }]}>{stats.total_drivers}</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Total Drivers</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="star-outline" size={18} color="#eab308" />
                <Text style={[s.kpiValue, { color: colors.text }]}>{(stats.avg_driver_rating ?? 0).toFixed(1)}</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Avg Rating</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="cube-outline" size={18} color={'#eab308'} />
                <Text style={[s.kpiValue, { color: colors.text }]}>{stats.avg_payload_tonnes}t</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Avg Payload</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="map-outline" size={18} color="#7c3aed" />
                <Text style={[s.kpiValue, { color: colors.text }]}>{(stats.total_mileage_km / 1000).toFixed(0)}k</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Total Km</Text>
              </View>
            </View>

            {/* Fleet Status Breakdown */}
            <Text style={[s.sectionTitle, { color: colors.text }]}>Fleet Status</Text>
            <View style={s.barRow}>
              {Object.entries(statusLabels).map(([key, label]) => {
                const count = byStatus[key]?.length ?? 0
                const pct = trucks.length > 0 ? (count / trucks.length) * 100 : 0
                const color = statusColors[key] ?? '#64748b'
                return (
                  <View key={key} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={[s.barValue, { color }]}>{count}</Text>
                    <View style={[s.barTrack, { backgroundColor: colors.muted }]}>
                      <View style={[s.barFill, { height: `${Math.max(pct, 4)}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[s.barLabel, { color: colors.textFaint }]}>{label}</Text>
                  </View>
                )
              })}
            </View>

            {/* Driver Availability */}
            <Text style={[s.sectionTitle, { color: colors.text, marginTop: 20 }]}>Driver Availability</Text>
            <View style={[s.kpiGrid, { marginTop: 0 }]}>
              <View style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
                <Text style={[s.kpiValue, { color: '#16a34a' }]}>{stats.available_drivers}</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Available</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
                <Text style={[s.kpiValue, { color: '#2563eb' }]}>{stats.on_route_drivers}</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>On Route</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
                <Text style={[s.kpiValue, { color: colors.textMuted }]}>{stats.total_drivers - stats.available_drivers - stats.on_route_drivers}</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Other</Text>
              </View>
            </View>

            {/* Recent Trucks */}
            <Text style={[s.sectionTitle, { color: colors.text, marginTop: 20 }]}>Truck Overview</Text>
            {trucks.slice(0, 8).map((t) => (
              <View key={t.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.cardRow}>
                  <View style={[s.iconBox, { backgroundColor: colors.muted }]}>
                    <Ionicons name="car-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.title, { color: colors.text }]}>{t.plate} · {t.make} {t.model}</Text>
                    <Text style={[s.sub, { color: colors.textMuted }]}>{t.payload_tonnes}t · {t.mileage_km.toLocaleString()} km</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: (statusColors[t.status] ?? '#64748b') + '18' }]}>
                    <View style={[s.dot, { backgroundColor: statusColors[t.status] }]} />
                    <Text style={[s.badgeText, { color: statusColors[t.status] }]}>{t.status_display}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : !loading ? (
          <View style={s.empty}>
            <Ionicons name="trending-up-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>
              No fleet data available
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  kpiCard: { width: '31%', borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  kpiValue: { fontSize: 24, fontWeight: '800' },
  kpiLabel: { fontSize: 10, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 12 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 6 },
  barTrack: { width: '60%', height: 50, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  barValue: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  barLabel: { fontSize: 9, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80 },
})
