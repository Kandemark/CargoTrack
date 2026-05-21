import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import { formatDate } from '@shared/utils/formatters'

interface ComplianceDoc {
  id: number; tracking_number: string; doc_type_display: string
  status_display: string; days_until_expiry: number | null
}

export default function CustomsDocumentsScreen() {
  const [docs, setDocs] = useState<ComplianceDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { colors, font, spacing, status, risk } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get<ComplianceDoc[]>('/api/v1/compliance/')
      setDocs(res.data ?? [])
    } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const validDocs = docs.filter(d => d.status_display === 'VALID').length
  const expiringSoon = docs.filter(d => d.status_display === 'EXPIRING' || (d.days_until_expiry !== null && d.days_until_expiry <= 30 && d.days_until_expiry > 0)).length
  const expiredDocs = docs.filter(d => d.status_display === 'EXPIRED' || (d.days_until_expiry !== null && d.days_until_expiry <= 0)).length

  function getStatusColor(statusDisplay: string): string {
    const key = (statusDisplay || '').toUpperCase()
    if (key === 'VALID') return status.delivered
    if (key === 'EXPIRED') return risk.high
    if (key === 'EXPIRING') return risk.medium
    if (key === 'MISSING') return status.pending
    return status.pending
  }

  function getStatusIcon(statusDisplay: string): 'checkmark-circle-outline' | 'alert-circle-outline' | 'time-outline' | 'help-circle-outline' {
    const key = (statusDisplay || '').toUpperCase()
    if (key === 'VALID') return 'checkmark-circle-outline'
    if (key === 'EXPIRED') return 'alert-circle-outline'
    if (key === 'EXPIRING') return 'time-outline'
    return 'help-circle-outline'
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Compliance Documents" backButton />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={status.inTransit} />
          <Text style={{ color: colors.textFaint, fontSize: font.size.base, marginTop: 12 }}>
            Loading compliance documents...
          </Text>
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => String(d.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={s.statsRow}>
              {([
                { label: 'Valid', value: validDocs, icon: 'checkmark-circle-outline' as const, color: status.delivered },
                { label: 'Expiring Soon', value: expiringSoon, icon: 'time-outline' as const, color: risk.medium },
                { label: 'Expired', value: expiredDocs, icon: 'alert-circle-outline' as const, color: risk.high },
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
              <Ionicons name="document-text-outline" size={48} color={colors.textFaint} />
              <Text style={[s.emptyTitle, { color: colors.textMuted }]}>No compliance documents</Text>
              <Text style={{ fontSize: font.size.sm, color: colors.textFaint, marginTop: 4 }}>
                Documents will appear once shipments are registered
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = getStatusColor(item.status_display)
            const icon = getStatusIcon(item.status_display)
            const isExpiring = item.days_until_expiry !== null && item.days_until_expiry <= 30 && item.days_until_expiry > 0
            const isExpired = item.days_until_expiry !== null && item.days_until_expiry <= 0
            const expiryColor = isExpired ? risk.high : isExpiring ? risk.medium : color

            return (
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: color, borderLeftWidth: 3 }]}>
                <View style={s.cardRow}>
                  <View style={[s.iconBox, { backgroundColor: colors.muted }]}>
                    <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.title, { color: colors.text }]}>{item.doc_type_display}</Text>
                    <Text style={[s.sub, { color: colors.textMuted }]}>
                      {item.tracking_number}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={[s.statusBadge, { backgroundColor: color + '18' }]}>
                      <Ionicons name={icon} size={12} color={color} />
                      <Text style={[s.statusText, { color }]}>{item.status_display}</Text>
                    </View>
                    {item.days_until_expiry !== null && (
                      <Text style={[s.expiryText, { color: expiryColor }]}>
                        {item.days_until_expiry > 0
                          ? `${item.days_until_expiry}d left`
                          : 'Expired'}
                      </Text>
                    )}
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
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  expiryText: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 12 },
})
