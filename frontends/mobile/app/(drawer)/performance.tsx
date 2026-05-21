import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface PerformanceData { avg_transit_days: number; on_time_delivery_pct: number; total_shipments: number; avg_delay_hours: number; best_carrier: string; worst_carrier: string }
interface DriverLeaderboardEntry { driver_name: string; shipment_count: number; on_time_pct: number; avg_rating: number; total_distance_km: number }
interface BidAnalytics { total_bids: number; accepted_bids: number; acceptance_rate: number; avg_bid_amount: number; top_bidder: string }

export default function PerformanceScreen() {
  const [perf, setPerf] = useState<PerformanceData | null>(null)
  const [leaderboard, setLeaderboard] = useState<DriverLeaderboardEntry[]>([])
  const [bids, setBids] = useState<BidAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, status, spacing } = useAppTheme()

  const fetchAll = useCallback(async () => {
    try {
      const [p, l, b] = await Promise.all([
        apiClient.get<PerformanceData>('/api/v1/analytics/performance/'),
        apiClient.get<DriverLeaderboardEntry[]>('/api/v1/analytics/driver-leaderboard/'),
        apiClient.get<BidAnalytics>('/api/v1/analytics/bid-analytics/'),
      ])
      setPerf(p.data); setLeaderboard(l.data ?? []); setBids(b.data)
    } catch {}
  }, [])

  useEffect(() => { fetchAll().finally(() => setLoading(false)) }, [fetchAll])
  async function handleRefresh() { setRefreshing(true); await fetchAll(); setRefreshing(false) }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Performance" backButton />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      >
        {perf ? (
          <>
            <View style={s.kpiGrid}>
              {[
                ['On-Time', `${perf.on_time_delivery_pct.toFixed(1)}%`, 'time-outline', '#16a34a'],
                ['Avg Transit', `${perf.avg_transit_days.toFixed(1)}d`, 'map-outline', '#2563eb'],
                ['Avg Delay', `${perf.avg_delay_hours.toFixed(1)}h`, 'alert-circle-outline', '#f5801e'],
                ['Shipments', String(perf.total_shipments), 'cube-outline', brand.primary],
              ].map(([label, val, icon, color]) => (
                <View key={label as string} style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name={icon as any} size={16} color={color as string} />
                  <Text style={[s.kpiVal, { color: colors.text }]}>{val as string}</Text>
                  <Text style={[s.kpiLabel, { color: colors.textFaint }]}>{label as string}</Text>
                </View>
              ))}
            </View>

            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.sectionTitle, { color: colors.text, marginTop: 0, marginBottom: 8 }]}>Carrier Comparison</Text>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: colors.textFaint, fontWeight: '600' }}>Best</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#16a34a' }}>{perf.best_carrier}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, color: colors.textFaint, fontWeight: '600' }}>Worst</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#ef4444' }}>{perf.worst_carrier}</Text>
                </View>
              </View>
            </View>

            {bids && (
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionTitle, { color: colors.text, marginTop: 0, marginBottom: 8 }]}>Bid Analytics</Text>
                <View style={s.row}>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint }}>Total Bids</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{bids.total_bids}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: colors.textFaint }}>Acceptance</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#16a34a' }}>{bids.acceptance_rate.toFixed(1)}%</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: colors.textFaint }}>Avg Bid</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: brand.primary }}>${bids.avg_bid_amount.toFixed(0)}</Text>
                  </View>
                </View>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Top Bidder: <Text style={{ fontWeight: '700', color: colors.text }}>{bids.top_bidder}</Text></Text>
              </View>
            )}

            <Text style={[s.sectionTitle, { color: colors.text }]}>Driver Leaderboard</Text>
            {leaderboard.slice(0, 10).map((d, i) => (
              <View key={d.driver_name} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[s.rank, { backgroundColor: i < 3 ? (['#eab308', '#94a3b8', '#cd7f32'][i]) : colors.muted }]}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: i < 3 ? '#fff' : colors.textMuted }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{d.driver_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{d.shipment_count} trips · {(d.total_distance_km ?? 0).toLocaleString()} km</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: d.on_time_pct >= 80 ? '#16a34a' : '#eab308' }}>{d.on_time_pct.toFixed(0)}%</Text>
                    <Text style={{ fontSize: 11, color: colors.textFaint }}>{d.avg_rating.toFixed(1)} ★</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : !loading ? (
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Ionicons name="trending-up-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No performance data</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpi: { width: '47%', borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  kpiVal: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  kpiLabel: { fontSize: 10, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, marginVertical: 10 },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
})
