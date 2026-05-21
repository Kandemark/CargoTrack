import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import { formatDate } from '@shared/utils/formatters'

interface Integration {
  id: number; name: string; category: string; status: string
  api_url: string; api_usage_pct: number; has_webhook: boolean
  last_sync: string | null; config: Record<string, any>
}

const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  customs: 'globe-outline',
  port: 'boat-outline',
  carrier: 'car-outline',
  payments: 'card-outline',
  finance: 'trending-up-outline',
  maps: 'map-outline',
  comms: 'chatbubbles-outline',
  sms: 'chatbubble-outline',
  email: 'mail-outline',
  tracking: 'location-outline',
  edi: 'code-outline',
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active:  { color: '#16a34a', label: 'Active' },
  inactive: { color: '#64748b', label: 'Inactive' },
  error:   { color: '#ef4444', label: 'Error' },
}

export default function IntegrationsScreen() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try { const res = await apiClient.get<Integration[]>('/api/v1/integrations/'); setIntegrations(res.data) } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const stats = useMemo(() => ({
    total: integrations.length,
    active: integrations.filter(i => i.status === 'active').length,
    withWebhooks: integrations.filter(i => i.has_webhook).length,
  }), [integrations])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Integrations" backButton />
      <FlatList
        data={integrations}
        keyExtractor={(i) => String(i.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListHeaderComponent={
          stats.total > 0 ? (
            <View style={s.statsRow}>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="link-outline" size={18} color={brand.primary} />
                <Text style={[s.statVal, { color: colors.text }]}>{stats.total}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Total</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#16a34a" />
                <Text style={[s.statVal, { color: '#16a34a' }]}>{stats.active}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Active</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="code-outline" size={18} color="#7c3aed" />
                <Text style={[s.statVal, { color: '#7c3aed' }]}>{stats.withWebhooks}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Webhooks</Text>
              </View>
            </View>
          ) : !loading ? null : (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={brand.primary} />
              <Text style={{ color: colors.textFaint, fontSize: font.size.sm, marginTop: 12 }}>Loading integrations...</Text>
            </View>
          )
        }
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="link-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No integrations configured</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const statusCfg = STATUS_CONFIG[item.status.toLowerCase()] ?? STATUS_CONFIG.inactive
          const icon = CATEGORY_ICONS[item.category.toLowerCase()] ?? 'link-outline'
          const usagePct = Math.min(item.api_usage_pct, 100)
          const barColor = usagePct > 80 ? '#ef4444' : usagePct > 60 ? '#eab308' : '#16a34a'

          return (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Header row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <View style={[s.iconBox, { backgroundColor: statusCfg.color + '18' }]}>
                  <Ionicons name={icon} size={20} color={statusCfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    {item.category}
                    {item.has_webhook ? ' · Webhooks' : ''}
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusCfg.color + '18' }]}>
                  <View style={[s.dot, { backgroundColor: statusCfg.color }]} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: statusCfg.color }}>{statusCfg.label}</Text>
                </View>
              </View>

              {/* Progress bar for API usage */}
              <View style={[s.progressTrack, { backgroundColor: colors.muted }]}>
                <View style={[s.progressFill, { width: `${usagePct}%`, backgroundColor: barColor }]} />
              </View>
              <Text style={{ fontSize: 10, color: colors.textFaint, textAlign: 'right', marginTop: 4 }}>
                {item.api_usage_pct.toFixed(0)}% API usage
              </Text>

              {/* Footer: last sync */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 10, color: colors.textFaint }}>
                  {item.api_url}
                </Text>
                {item.last_sync ? (
                  <Text style={{ fontSize: 10, color: colors.textFaint }}>Synced {formatDate(item.last_sync)}</Text>
                ) : (
                  <Text style={{ fontSize: 10, color: colors.textFaint }}>Never synced</Text>
                )}
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statBox: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  empty: { alignItems: 'center', paddingTop: 80 },
})
