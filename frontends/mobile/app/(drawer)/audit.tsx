import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import { formatDate } from '@shared/utils/formatters'

interface AuditEntry {
  id: number; username: string; full_name: string; action: string
  model_name: string; object_id: number; changes: string; created_at: string
}

type ActionIcon = React.ComponentProps<typeof Ionicons>['name']

const ACTION_ICONS: Record<string, ActionIcon> = {
  create: 'add-circle',
  update: 'create',
  delete: 'trash',
  login: 'log-in',
  logout: 'log-out',
}
const DEFAULT_ACTION_ICON: ActionIcon = 'ellipse'

export default function AuditScreen() {
  const user = useAuthStore((s) => s.user)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, brand, spacing } = useAppTheme()

  if (user && user.role !== 'ADMIN') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1929' }}>
        <ScreenHeader title="Audit Log" backButton />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="lock-closed" size={48} color="#64748b" />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16 }}>Access Denied</Text>
          <Text style={{ color: '#93b4d8', fontSize: 14, textAlign: 'center', marginTop: 8 }}>Only administrators can view the audit log.</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, backgroundColor: '#f5801e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const fetchData = useCallback(async () => {
    try { const res = await apiClient.get<AuditEntry[]>('/api/v1/audit/'); setEntries(res.data) } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const todayCount = entries.filter(e => new Date(e.created_at).toDateString() === today).length
    return { total: entries.length, today: todayCount }
  }, [entries])

  function iconForAction(action: string): ActionIcon {
    const lower = action.toLowerCase()
    return ACTION_ICONS[lower] ?? DEFAULT_ACTION_ICON
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Audit Log" backButton />
      <FlatList
        data={entries}
        keyExtractor={(e) => String(e.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListHeaderComponent={
          stats.total > 0 ? (
            <View style={s.statsRow}>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: colors.text }]}>{stats.total}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Total Entries</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: brand.primary }]}>{stats.today}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Today</Text>
              </View>
            </View>
          ) : !loading ? null : (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={brand.primary} />
              <Text style={{ color: colors.textFaint, fontSize: font.size.sm, marginTop: 12 }}>Loading audit entries...</Text>
            </View>
          )
        }
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="reader-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No audit entries</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const icon = iconForAction(item.action)
          return (
            <View style={s.timelineRow}>
              {/* Timeline dot + line */}
              <View style={s.timelineLeft}>
                <View style={[s.timelineDot, { backgroundColor: colors.card, borderColor: brand.primary }]}>
                  <Ionicons name={icon} size={14} color={brand.primary} />
                </View>
                <View style={[s.timelineLine, { backgroundColor: colors.border }]} />
              </View>
              {/* Content card */}
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>
                      {item.action}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {item.full_name} (@{item.username})
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: colors.textFaint }}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>
                {item.model_name ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <View style={[s.chip, { backgroundColor: colors.muted }]}>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>{item.model_name}</Text>
                    </View>
                    {item.object_id != null && (
                      <Text style={{ fontSize: 10, color: colors.textFaint, alignSelf: 'center' }}>#{item.object_id}</Text>
                    )}
                  </View>
                ) : null}
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
  statBox: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  statVal: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  timelineRow: { flexDirection: 'row', marginBottom: 4 },
  timelineLeft: { width: 28, alignItems: 'center' },
  timelineDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  card: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, marginLeft: 8 },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', paddingTop: 80 },
})
