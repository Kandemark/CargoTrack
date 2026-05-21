import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface AnalyticsEntry { total_shipments: number; on_time_rate: number; avg_delay_hours: number; revenue_total: number }

interface ProfitEntry { month: string; revenue: number; cost: number; profit: number }
interface SLAEntry { id: number; tracking_number: string; sla_status: string; sla_status_display: string; breach_hours: number | null }

export default function FinanceReportsScreen() {
  const [analytics, setAnalytics] = useState<AnalyticsEntry | null>(null)
  const [profit, setProfit] = useState<ProfitEntry[]>([])
  const [sla, setSla] = useState<SLAEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, spacing } = useAppTheme()

  const fetchAll = useCallback(async () => {
    try {
      const [a, p, s] = await Promise.all([
        apiClient.get<AnalyticsEntry>('/api/v1/analytics/'),
        apiClient.get<ProfitEntry[]>('/api/v1/analytics/profit/'),
        apiClient.get<{ items: SLAEntry[] }>('/api/v1/analytics/sla/'),
      ])
      setAnalytics(a.data); setProfit(p.data ?? []); setSla(s.data?.items ?? [])
    } catch {}
  }, [])

  useEffect(() => { fetchAll().finally(() => setLoading(false)) }, [fetchAll])
  async function handleRefresh() { setRefreshing(true); await fetchAll(); setRefreshing(false) }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Reports" backButton />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      >
        {analytics ? (
          <>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Overview</Text>
            <View style={s.kpiGrid}>
              {[
                ['Total Shipments', String(analytics.total_shipments), 'cube-outline', brand.primary],
                ['On-Time', `${analytics.on_time_rate.toFixed(1)}%`, 'time-outline', '#16a34a'],
                ['Avg Delay', `${analytics.avg_delay_hours.toFixed(1)}h`, 'alert-circle-outline', '#f5801e'],
                ['Revenue', `$${(analytics.revenue_total / 1000).toFixed(1)}k`, 'card-outline', '#7c3aed'],
              ].map(([label, val, icon, color]) => (
                <View key={label as string} style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name={icon as any} size={16} color={color as string} />
                  <Text style={[s.kpiVal, { color: colors.text }]}>{val as string}</Text>
                  <Text style={[s.kpiLabel, { color: colors.textFaint }]}>{label as string}</Text>
                </View>
              ))}
            </View>

            <Text style={[s.sectionTitle, { color: colors.text }]}>Monthly Profit</Text>
            {profit.slice(-6).map((p) => (
              <View key={p.month} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{p.month}</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#16a34a' }}>+${(p.revenue / 1000).toFixed(1)}k</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#ef4444' }}>-${(p.cost / 1000).toFixed(1)}k</Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: p.profit >= 0 ? '#16a34a' : '#ef4444' }}>${(p.profit / 1000).toFixed(1)}k</Text>
                  </View>
                </View>
              </View>
            ))}

            <Text style={[s.sectionTitle, { color: colors.text }]}>SLA Breaches</Text>
            {sla.filter(x => x.sla_status === 'BREACHED').slice(0, 8).map((item) => (
              <View key={item.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: '#ef4444', borderLeftWidth: 3 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{item.tracking_number}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#ef4444' }}>{item.breach_hours?.toFixed(1) ?? '?'}h breach</Text>
                </View>
              </View>
            ))}
            {sla.filter(x => x.sla_status === 'BREACHED').length === 0 && (
              <Text style={{ fontSize: 13, color: colors.textFaint, textAlign: 'center', paddingVertical: 20 }}>No SLA breaches — all shipments on track.</Text>
            )}
          </>
        ) : !loading ? (
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Ionicons name="bar-chart-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No report data</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10, marginTop: 8 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  kpi: { width: '47%', borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  kpiVal: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  kpiLabel: { fontSize: 10, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 6 },
})
