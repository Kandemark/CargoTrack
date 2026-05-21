import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import { formatDate, daysUntil } from '@shared/utils/formatters'

interface ComplianceDoc {
  id: number; tracking_number: string; doc_type_display: string
  status: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'MISSING'
  status_display: string; days_until_expiry: number
  issued_date: string | null; issuing_authority: string | null
}

const STATUS_BG: Record<string, string> = {
  VALID: '#16a34a',
  EXPIRING: '#eab308',
  EXPIRED: '#ef4444',
  MISSING: '#64748b',
}

const STATUS_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  VALID: 'checkmark-circle',
  EXPIRING: 'alert-circle',
  EXPIRED: 'close-circle',
  MISSING: 'help-circle',
}

export default function ComplianceScreen() {
  const [docs, setDocs] = useState<ComplianceDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const { colors, font, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try { const res = await apiClient.get<ComplianceDoc[]>('/api/v1/compliance/'); setDocs(res.data) } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const stats = useMemo(() => ({
    total: docs.length,
    valid: docs.filter(d => d.status === 'VALID').length,
    expiring: docs.filter(d => d.days_until_expiry <= 14 && d.status !== 'EXPIRED' && d.status !== 'MISSING').length,
    expired: docs.filter(d => d.status === 'EXPIRED').length,
  }), [docs])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Compliance" backButton />
      <FlatList
        data={docs}
        keyExtractor={(d) => String(d.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListHeaderComponent={
          stats.total > 0 ? (
            <View style={s.statsRow}>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: colors.text }]}>{stats.total}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Total</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: '#16a34a' }]}>{stats.valid}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Valid</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: '#eab308' }]}>{stats.expiring}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Expiring</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: '#ef4444' }]}>{stats.expired}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Expired</Text>
              </View>
            </View>
          ) : !loading ? null : (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.textFaint} />
              <Text style={{ color: colors.textFaint, fontSize: font.size.sm, marginTop: 12 }}>Loading compliance documents...</Text>
            </View>
          )
        }
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No compliance documents</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.id
          const bgColor = STATUS_BG[item.status] ?? '#64748b'
          const icon = STATUS_ICONS[item.status] ?? 'document-outline'

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setExpandedId(isExpanded ? null : item.id)}
              style={[s.card, { backgroundColor: bgColor + '14', borderColor: bgColor + '40', borderLeftColor: bgColor, borderLeftWidth: 3 }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.iconBox, { backgroundColor: bgColor + '28' }]}>
                  <Ionicons name={icon} size={20} color={bgColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.doc_type_display}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    {item.tracking_number || 'No tracking number'}
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: bgColor + '28' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: bgColor }}>{item.status_display}</Text>
                </View>
              </View>

              {/* Days until expiry */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <Ionicons name="calendar-outline" size={12} color={bgColor} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: bgColor }}>
                  {item.status === 'EXPIRED'
                    ? 'Expired'
                    : item.status === 'MISSING'
                    ? 'Missing'
                    : `${item.days_until_expiry} days until expiry`}
                </Text>
              </View>

              {/* Expanded details */}
              {isExpanded && (
                <View style={[s.detailBox, { backgroundColor: colors.muted, borderTopColor: colors.border }]}>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Status</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{item.status_display}</Text>
                  </View>
                  {item.issued_date && (
                    <View style={s.detailRow}>
                      <Text style={[s.detailLabel, { color: colors.textFaint }]}>Issued</Text>
                      <Text style={[s.detailValue, { color: colors.text }]}>{formatDate(item.issued_date)}</Text>
                    </View>
                  )}
                  {item.issuing_authority && (
                    <View style={s.detailRow}>
                      <Text style={[s.detailLabel, { color: colors.textFaint }]}>Authority</Text>
                      <Text style={[s.detailValue, { color: colors.text }]}>{item.issuing_authority}</Text>
                    </View>
                  )}
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Tracking #</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{item.tracking_number || 'N/A'}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  detailBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 12, fontWeight: '500' },
  detailValue: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
})
