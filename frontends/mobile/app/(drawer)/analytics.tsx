import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface AnalyticsData { total_shipments: number; active_shipments: number; delivered_shipments: number; on_time_rate: number; avg_delay_hours: number; revenue_total: number }
interface ProfitData { month: string; revenue: number; cost: number; profit: number }
interface RouteAnalytics { route_name: string; shipment_count: number; avg_delay_hours: number; on_time_pct: number }
interface CorridorData { corridor: string; shipment_count: number; avg_transit_days: number; on_time_pct: number }
interface DriverAnalytics { driver_name: string; shipment_count: number; avg_rating: number; on_time_pct: number }

const TABS = ['Overview', 'Profit', 'Routes', 'Corridors', 'Drivers']

export default function AnalyticsScreen() {
  const [tab, setTab] = useState(0)
  const [overview, setOverview] = useState<AnalyticsData | null>(null)
  const [profit, setProfit] = useState<ProfitData[]>([])
  const [routes, setRoutes] = useState<RouteAnalytics[]>([])
  const [corridors, setCorridors] = useState<CorridorData[]>([])
  const [drivers, setDrivers] = useState<DriverAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, spacing } = useAppTheme()

  const fetchAll = useCallback(async () => {
    try {
      const [a, p, r, c, d] = await Promise.all([
        apiClient.get<AnalyticsData>('/api/v1/analytics/'),
        apiClient.get<ProfitData[]>('/api/v1/analytics/profit/'),
        apiClient.get<RouteAnalytics[]>('/api/v1/analytics/routes/'),
        apiClient.get<CorridorData[]>('/api/v1/analytics/corridors/'),
        apiClient.get<DriverAnalytics[]>('/api/v1/analytics/drivers/'),
      ])
      setOverview(a.data); setProfit(p.data); setRoutes(r.data); setCorridors(c.data); setDrivers(d.data)
    } catch {}
  }, [])

  useEffect(() => { fetchAll().finally(() => setLoading(false)) }, [fetchAll])
  async function handleRefresh() { setRefreshing(true); await fetchAll(); setRefreshing(false) }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Analytics" backButton />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: spacing.md, marginTop: 8 }}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t} onPress={() => setTab(i)} style={[s.tab, { backgroundColor: tab === i ? brand.primary : colors.muted, marginRight: 8 }]}>
              <Text style={[s.tabText, { color: tab === i ? '#fff' : colors.textMuted }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ padding: spacing.md }}>
          {tab === 0 && overview && (
            <>
              <View style={s.kpiGrid}>
                {[
                  ['Total', overview.total_shipments, 'cube-outline', brand.primary],
                  ['Active', overview.active_shipments, 'map-outline', '#2563eb'],
                  ['Delivered', overview.delivered_shipments, 'checkmark-done-outline', '#16a34a'],
                  ['On-Time', `${overview.on_time_rate.toFixed(1)}%`, 'time-outline', '#eab308'],
                ].map(([label, val, icon, color]) => (
                  <View key={label as string} style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name={icon as any} size={18} color={color as string} />
                    <Text style={[s.kpiVal, { color: colors.text }]}>{val as string}</Text>
                    <Text style={[s.kpiLabel, { color: colors.textFaint }]}>{label as string}</Text>
                  </View>
                ))}
              </View>
              <View style={[s.kpiGrid, { marginTop: 8 }]}>
                {[
                  ['Avg Delay', `${overview.avg_delay_hours.toFixed(1)}h`, 'alert-circle-outline', '#f5801e'],
                  ['Revenue', `$${(overview.revenue_total / 1000).toFixed(0)}k`, 'card-outline', '#7c3aed'],
                ].map(([label, val, icon, color]) => (
                  <View key={label as string} style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border, flex: 0.48 }]}>
                    <Ionicons name={icon as any} size={18} color={color as string} />
                    <Text style={[s.kpiVal, { color: colors.text }]}>{val as string}</Text>
                    <Text style={[s.kpiLabel, { color: colors.textFaint }]}>{label as string}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {tab === 1 && (
            <>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Monthly Profit</Text>
              {profit.slice(-6).map((p) => (
                <View key={p.month} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{p.month}</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#16a34a' }}>+${(p.revenue / 1000).toFixed(1)}k</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#ef4444' }}>-${(p.cost / 1000).toFixed(1)}k</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: p.profit >= 0 ? '#16a34a' : '#ef4444' }}>${(p.profit / 1000).toFixed(1)}k</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {tab === 2 && routes.map((r) => (
            <View key={r.route_name} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{r.route_name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{r.shipment_count} shipments · {r.avg_delay_hours.toFixed(1)}h avg delay</Text>
                </View>
                <View style={[s.badge, { backgroundColor: r.on_time_pct >= 80 ? '#16a34a20' : '#eab30820' }]}>
                  <Text style={[s.badgeText, { color: r.on_time_pct >= 80 ? '#16a34a' : '#eab308' }]}>{r.on_time_pct.toFixed(0)}%</Text>
                </View>
              </View>
            </View>
          ))}

          {tab === 3 && corridors.map((c) => (
            <View key={c.corridor} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{c.corridor}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{c.shipment_count} shipments · {c.avg_transit_days.toFixed(1)} days</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: c.on_time_pct >= 80 ? '#16a34a' : '#eab308' }}>{c.on_time_pct.toFixed(0)}%</Text>
              </View>
            </View>
          ))}

          {tab === 4 && drivers.map((d) => {
            const initials = d.driver_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            return (
              <View key={d.driver_name} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[s.avatarSmall, { backgroundColor: brand.primary }]}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{d.driver_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{d.shipment_count} trips · {d.avg_rating.toFixed(1)}★</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: d.on_time_pct >= 80 ? '#16a34a' : '#eab308' }}>{d.on_time_pct.toFixed(0)}%</Text>
                </View>
              </View>
            )
          })}

          {loading && (
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <Text style={{ color: colors.textFaint, fontSize: 14 }}>Loading analytics...</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  tabText: { fontSize: 13, fontWeight: '700' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '47%', borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  kpiVal: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  kpiLabel: { fontSize: 10, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
})
