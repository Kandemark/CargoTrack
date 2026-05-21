import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import AnimatedNumber from '@/components/animated/AnimatedNumber'
import ScreenWrapper from '@/components/animated/ScreenWrapper'
import RequireRole from '@/components/RequireRole'

interface DashboardSummary { total_shipments: number; active_shipments: number; delivered_shipments: number; delayed_shipments: number; on_time_rate: number; exception_count: number; carrier_count: number; open_alerts: number }
interface CarrierPerf { carrier_name: string; shipment_count: number; avg_risk: number; on_time: number }
interface ShipmentItem { id: number; tracking_number: string; carrier_name: string; status: string; status_display: string; scheduled_arrival: string; delay_risk_score: number; route_name: string }

export default function OpsDashboardScreen() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [carriers, setCarriers] = useState<CarrierPerf[]>([])
  const [shipments, setShipments] = useState<ShipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, spacing } = useAppTheme()

  const fetchAll = useCallback(async () => {
    try {
      const [dash, ship] = await Promise.all([
        apiClient.get<{ summary: DashboardSummary; carrier_performance: CarrierPerf[] }>('/api/v1/dashboard/stats/'),
        apiClient.get<{ results: ShipmentItem[] }>('/api/v1/shipments/'),
      ])
      setSummary(dash.data.summary)
      setCarriers(dash.data.carrier_performance ?? [])
      setShipments(ship.data.results ?? [])
    } catch {}
  }, [])

  useEffect(() => { fetchAll().finally(() => setLoading(false)) }, [fetchAll])
  async function handleRefresh() { setRefreshing(true); await fetchAll(); setRefreshing(false) }

  return (
    <RequireRole roles={['ADMIN', 'LOGISTICS_MGR']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Operations" backButton />
      <ScreenWrapper entrance="fade">
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        >
          {summary ? (
            <>
              <View style={s.kpiGrid}>
                {([
                  ['Active', summary.active_shipments, 'map-outline', '#2563eb'],
                  ['Delivered', summary.delivered_shipments, 'checkmark-done', '#16a34a'],
                  ['Delayed', summary.delayed_shipments, 'alert-circle', '#ef4444'],
                  ['On-Time', `${summary.on_time_rate.toFixed(0)}%`, 'time-outline', '#eab308'],
                  ['Carriers', summary.carrier_count, 'car-outline', brand.primary],
                  ['Open Alerts', summary.open_alerts, 'notifications-outline', '#f5801e'],
                ] as const).map(([label, val, icon, color]) => (
                  <View key={label} style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name={icon as any} size={16} color={color} />
                    {typeof val === 'number' ? (
                      <AnimatedNumber value={val} style={[s.kpiVal, { color: colors.text }]} />
                    ) : (
                      <Text style={[s.kpiVal, { color: colors.text }]}>{val}</Text>
                    )}
                    <Text style={[s.kpiLabel, { color: colors.textFaint }]}>{label}</Text>
                  </View>
                ))}
              </View>

              <Text style={[s.sectionTitle, { color: colors.text }]}>Carrier Performance</Text>
              {carriers.slice(0, 5).map((c) => (
                <View key={c.carrier_name} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{c.carrier_name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{c.shipment_count} shipments · Risk {c.avg_risk.toFixed(0)}%</Text>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: c.on_time >= 80 ? '#16a34a' : '#eab308' }}>{c.on_time.toFixed(0)}%</Text>
                  </View>
                </View>
              ))}

              <Text style={[s.sectionTitle, { color: colors.text }]}>Recent Shipments</Text>
              {shipments.slice(0, 8).map((ship) => (
                <View key={ship.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{ship.tracking_number}</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{ship.carrier_name} · {ship.route_name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[s.badge, { backgroundColor: colors.muted }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted }}>{ship.status_display}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 4 }}>Risk: {ship.delay_risk_score}%</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          ) : !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <Ionicons name="stats-chart-outline" size={48} color={colors.textFaint} />
              <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No operations data</Text>
            </View>
          ) : null}
        </ScrollView>
      </ScreenWrapper>
    </View>
  </RequireRole>
  )
}

const s = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpi: { width: '31%', borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  kpiVal: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  kpiLabel: { fontSize: 9, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10, marginTop: 8 },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 6 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
})
