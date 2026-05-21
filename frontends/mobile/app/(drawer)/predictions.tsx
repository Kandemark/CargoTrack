import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface ShipmentRisk {
  id: number; tracking_number: string; carrier_name: string; status: string; delay_risk_score: number
  route_name?: string; scheduled_arrival?: string
}

export default function PredictionsScreen() {
  const [shipments, setShipments] = useState<ShipmentRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, status, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get<{ results: ShipmentRisk[] }>('/api/v1/shipments/')
      setShipments(res.data.results ?? [])
    } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  function riskColor(score: number) {
    if (score >= 70) return '#ef4444'
    if (score >= 40) return '#f5801e'
    if (score >= 20) return '#eab308'
    return '#16a34a'
  }

  function riskLabel(score: number) {
    if (score >= 70) return 'High Risk'
    if (score >= 40) return 'Medium Risk'
    if (score >= 20) return 'Low Risk'
    return 'Safe'
  }

  const sorted = [...shipments].sort((a, b) => b.delay_risk_score - a.delay_risk_score)
  const avgRisk = shipments.length > 0 ? shipments.reduce((s, x) => s + x.delay_risk_score, 0) / shipments.length : 0
  const highRiskCount = shipments.filter(s => s.delay_risk_score >= 70).length

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="AI Predictions" backButton />
      <FlatList
        data={sorted}
        keyExtractor={(s) => String(s.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={s.kpiRow}>
            <View style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.kpiVal, { color: colors.text }]}>{shipments.length}</Text>
              <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Analyzed</Text>
            </View>
            <View style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.kpiVal, { color: riskColor(avgRisk) }]}>{avgRisk.toFixed(1)}</Text>
              <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Avg Risk Score</Text>
            </View>
            <View style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.kpiVal, { color: '#ef4444' }]}>{highRiskCount}</Text>
              <Text style={[s.kpiLabel, { color: colors.textFaint }]}>High Risk</Text>
            </View>
          </View>
        }
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="bulb-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No shipments to analyze</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const color = riskColor(item.delay_risk_score)
          return (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: color, borderLeftWidth: 3 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.tracking_number}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.carrier_name}{item.route_name ? ` · ${item.route_name}` : ''}</Text>
                  {item.scheduled_arrival && <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>ETA: {new Date(item.scheduled_arrival).toLocaleDateString()}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[s.riskBar, { backgroundColor: colors.muted }]}>
                      <View style={[s.riskFill, { width: `${item.delay_risk_score}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color, width: 40, textAlign: 'right' }}>{item.delay_risk_score}</Text>
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '600', color, marginTop: 2 }}>{riskLabel(item.delay_risk_score)}</Text>
                </View>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpi: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  kpiVal: { fontSize: 24, fontWeight: '800' },
  kpiLabel: { fontSize: 9, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  riskBar: { width: 60, height: 6, borderRadius: 3, overflow: 'hidden' },
  riskFill: { height: 6, borderRadius: 3 },
  empty: { alignItems: 'center', paddingTop: 80 },
})
