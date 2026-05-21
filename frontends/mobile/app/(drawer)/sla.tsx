import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface SLAItem {
  id: number; tracking_number: string; carrier_name: string; route_name: string
  scheduled_arrival: string; actual_arrival: string | null; breach_hours: number | null
  sla_status: 'ON_TIME' | 'AT_RISK' | 'BREACHED'; sla_status_display: string
}

interface SLAData {
  items: SLAItem[]; on_time_pct: number; at_risk_pct: number; breached_pct: number; total_shipments: number
}

export default function SLAScreen() {
  const [data, setData] = useState<SLAData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, status, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get<SLAData>('/api/v1/analytics/sla/')
      setData(res.data)
    } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const slaStatusColor: Record<string, string> = { ON_TIME: '#16a34a', AT_RISK: '#eab308', BREACHED: '#ef4444' }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="SLA Monitor" backButton />
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListHeaderComponent={data ? (
          <View style={{ marginBottom: 12 }}>
            <View style={s.kpiRow}>
              <View style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.kpiVal, { color: '#16a34a' }]}>{data.on_time_pct.toFixed(1)}%</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>On Time</Text>
              </View>
              <View style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.kpiVal, { color: '#eab308' }]}>{data.at_risk_pct.toFixed(1)}%</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>At Risk</Text>
              </View>
              <View style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.kpiVal, { color: '#ef4444' }]}>{data.breached_pct.toFixed(1)}%</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Breached</Text>
              </View>
            </View>
          </View>
        ) : null}
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No SLA data</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: slaStatusColor[item.sla_status], borderLeftWidth: 3 }]}>
            <View style={s.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: colors.text }]}>{item.tracking_number}</Text>
                <Text style={[s.sub, { color: colors.textMuted }]}>{item.carrier_name} · {item.route_name}</Text>
                <Text style={[s.sub, { color: colors.textFaint, marginTop: 4 }]}>
                  Scheduled: {new Date(item.scheduled_arrival).toLocaleDateString()}
                  {item.breach_hours != null ? ` · ${item.breach_hours.toFixed(1)}h breach` : ''}
                </Text>
              </View>
              <View style={[s.badge, { backgroundColor: (slaStatusColor[item.sla_status] ?? '#64748b') + '18' }]}>
                <View style={[s.dot, { backgroundColor: slaStatusColor[item.sla_status] }]} />
                <Text style={[s.badgeText, { color: slaStatusColor[item.sla_status] }]}>{item.sla_status_display}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  kpiVal: { fontSize: 26, fontWeight: '800' },
  kpiLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80 },
})
