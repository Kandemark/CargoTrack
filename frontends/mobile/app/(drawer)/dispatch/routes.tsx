import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface RouteAnalytics {
  route_name: string; shipment_count: number; avg_delay_hours: number; on_time_pct: number
}

export default function DispatchRoutesScreen() {
  const [routes, setRoutes] = useState<RouteAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, spacing, status, risk } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get<RouteAnalytics[]>('/api/v1/analytics/routes/')
      setRoutes(res.data ?? [])
    } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const sortedRoutes = [...routes].sort((a, b) => b.on_time_pct - a.on_time_pct)
  const best = sortedRoutes[0]
  const worst = sortedRoutes[sortedRoutes.length - 1]

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Route Analytics" backButton />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={status.inTransit} />
          <Text style={{ color: colors.textFaint, fontSize: font.size.base, marginTop: 12 }}>
            Loading route analytics...
          </Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => r.route_name}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={s.statsRow}>
              {([
                { label: 'Total Routes', value: routes.length, icon: 'git-branch-outline' as const, color: status.inTransit },
                { label: 'Best Route', value: best ? `${best.on_time_pct.toFixed(0)}%` : '—', icon: 'trophy-outline' as const, color: status.delivered },
                { label: 'Worst Route', value: worst ? `${worst.on_time_pct.toFixed(0)}%` : '—', icon: 'trending-down-outline' as const, color: risk.high },
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
              <Ionicons name="git-branch-outline" size={48} color={colors.textFaint} />
              <Text style={[s.emptyTitle, { color: colors.textMuted }]}>No routes found</Text>
              <Text style={{ fontSize: font.size.sm, color: colors.textFaint, marginTop: 4 }}>
                Route analytics will appear once shipments are logged
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const pctColor = item.on_time_pct >= 80 ? status.delivered : item.on_time_pct >= 60 ? risk.medium : risk.high
            const pctBg = pctColor + '18'
            return (
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.cardRow}>
                  <View style={[s.iconBox, { backgroundColor: colors.muted }]}>
                    <Ionicons name="git-branch-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.title, { color: colors.text }]}>{item.route_name}</Text>
                    <Text style={[s.sub, { color: colors.textMuted }]}>
                      {item.shipment_count} shipments · {item.avg_delay_hours.toFixed(1)}h avg delay
                    </Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: pctBg }]}>
                    <Text style={[s.badgeText, { color: pctColor }]}>{item.on_time_pct.toFixed(0)}%</Text>
                  </View>
                </View>
              </View>
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
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 12 },
})
