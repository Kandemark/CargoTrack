import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface CarbonData {
  total_kg: number; offset_kg: number; net_kg: number
  monthly: Array<{ month: string; emissions_kg: number; offset_kg: number }>
  by_carrier: Array<{ carrier_name: string; emissions_kg: number; offset_kg: number; grade: string }>
}

export default function CarbonScreen() {
  const [data, setData] = useState<CarbonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try { const res = await apiClient.get<CarbonData>('/api/v1/analytics/carbon/'); setData(res.data) } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const gradeColor: Record<string, string> = { 'A+': '#16a34a', A: '#16a34a', B: '#2563eb', C: '#eab308', D: '#f5801e', F: '#ef4444' }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Carbon Tracker" backButton />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      >
        {data ? (
          <>
            {/* Main KPIs */}
            <View style={s.kpiRow}>
              <View style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.kpiVal, { color: colors.text }]}>{(data.total_kg / 1000).toFixed(1)}t</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Total Emissions</Text>
              </View>
              <View style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.kpiVal, { color: '#16a34a' }]}>{(data.offset_kg / 1000).toFixed(1)}t</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Offset</Text>
              </View>
              <View style={[s.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.kpiVal, { color: brand.primary }]}>{(data.net_kg / 1000).toFixed(1)}t</Text>
                <Text style={[s.kpiLabel, { color: colors.textFaint }]}>Net</Text>
              </View>
            </View>

            {/* Monthly breakdown */}
            <Text style={[s.sectionTitle, { color: colors.text }]}>Monthly Emissions</Text>
            {data.monthly.slice(-6).map((m) => {
              const max = Math.max(...data.monthly.map(x => x.emissions_kg), 1)
              return (
                <View key={m.month} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>{m.month}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{(m.emissions_kg / 1000).toFixed(1)}t</Text>
                  </View>
                  <View style={[s.barTrack, { backgroundColor: colors.muted }]}>
                    <View style={[s.barFill, { width: `${(m.emissions_kg / max) * 100}%`, backgroundColor: brand.primary }]} />
                    {m.offset_kg > 0 && (
                      <View style={[s.offsetMarker, { left: `${((m.emissions_kg - m.offset_kg) / max) * 100}%` }]} />
                    )}
                  </View>
                </View>
              )
            })}

            {/* Carrier grades */}
            <Text style={[s.sectionTitle, { color: colors.text, marginTop: 16 }]}>Carrier Grades</Text>
            {data.by_carrier.map((c) => (
              <View key={c.carrier_name} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{c.carrier_name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {(c.emissions_kg / 1000).toFixed(1)}t emitted · {(c.offset_kg / 1000).toFixed(1)}t offset
                    </Text>
                  </View>
                  <View style={[s.grade, { backgroundColor: (gradeColor[c.grade] ?? '#64748b') + '20' }]}>
                    <Text style={[s.gradeText, { color: gradeColor[c.grade] ?? '#64748b' }]}>{c.grade}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : !loading ? (
          <View style={s.empty}>
            <Ionicons name="leaf-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No carbon data</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpi: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  kpiVal: { fontSize: 24, fontWeight: '800' },
  kpiLabel: { fontSize: 10, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  barTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, position: 'absolute', left: 0 },
  offsetMarker: { position: 'absolute', width: 2, height: 14, backgroundColor: '#16a34a', top: -2 },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  grade: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gradeText: { fontSize: 14, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 80 },
})
