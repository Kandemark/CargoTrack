import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import { formatDate } from '@shared/utils/formatters'

interface RateCard {
  id: number; carrier_name: string; name: string; status: string
  origin: string; destination: string; cargo_type: string
  per_kg: string; per_km: string; min_charge: string; currency: string
  is_hazmat: boolean; is_reefer: boolean; valid_from: string; valid_until: string
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  ACTIVE:  { color: '#16a34a', label: 'Active' },
  INACTIVE: { color: '#64748b', label: 'Inactive' },
  EXPIRED: { color: '#ef4444', label: 'Expired' },
}

export default function RatesScreen() {
  const [rates, setRates] = useState<RateCard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const { colors, font, brand, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try { const res = await apiClient.get<RateCard[]>('/api/v1/rate-cards/'); setRates(res.data) } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  const stats = useMemo(() => {
    const activeRates = rates.filter(r => r.status === 'ACTIVE')
    const avgPerKg = activeRates.length
      ? activeRates.reduce((sum, r) => sum + parseFloat(r.per_kg || '0'), 0) / activeRates.length
      : 0
    return {
      total: rates.length,
      active: activeRates.length,
      avgPerKg,
    }
  }, [rates])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Rate Cards" backButton />
      <FlatList
        data={rates}
        keyExtractor={(r) => String(r.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListHeaderComponent={
          stats.total > 0 ? (
            <View style={s.statsRow}>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: colors.text }]}>{stats.total}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Total Rates</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: '#16a34a' }]}>{stats.active}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Active</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statVal, { color: brand.primary }]}>${stats.avgPerKg.toFixed(2)}</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Avg /kg</Text>
              </View>
            </View>
          ) : !loading ? null : (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={brand.primary} />
              <Text style={{ color: colors.textFaint, fontSize: font.size.sm, marginTop: 12 }}>Loading rate cards...</Text>
            </View>
          )
        }
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="cash-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No rate cards found</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.id
          const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.INACTIVE

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setExpandedId(isExpanded ? null : item.id)}
              style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: statusCfg.color, borderLeftWidth: 3 }]}
            >
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <View style={[s.iconBox, { backgroundColor: statusCfg.color + '18' }]}>
                  <Ionicons name="cash-outline" size={18} color={statusCfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                    {item.origin} → {item.destination}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    {item.carrier_name} · {item.cargo_type}
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusCfg.color + '18' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: statusCfg.color }}>{statusCfg.label}</Text>
                </View>
              </View>

              {/* Key rates */}
              <View style={[s.rateRow, { borderTopColor: colors.border }]}>
                <View>
                  <Text style={[s.rateLabel, { color: colors.textFaint }]}>Per Kg</Text>
                  <Text style={[s.rateValue, { color: colors.text }]}>
                    {item.currency ?? '$'} {parseFloat(item.per_kg).toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={[s.rateLabel, { color: colors.textFaint }]}>Min Charge</Text>
                  <Text style={[s.rateValue, { color: colors.text }]}>
                    {item.currency ?? '$'} {parseFloat(item.min_charge).toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={[s.rateLabel, { color: colors.textFaint }]}>Valid Until</Text>
                  <Text style={[s.rateValue, { color: colors.textMuted, fontSize: 12 }]}>
                    {formatDate(item.valid_until)}
                  </Text>
                </View>
              </View>

              {/* Tags */}
              {(item.is_hazmat || item.is_reefer) && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {item.is_hazmat && (
                    <View style={[s.tag, { backgroundColor: '#ef444418' }]}>
                      <Text style={[s.tagText, { color: '#ef4444' }]}>HAZMAT</Text>
                    </View>
                  )}
                  {item.is_reefer && (
                    <View style={[s.tag, { backgroundColor: '#3b82f618' }]}>
                      <Text style={[s.tagText, { color: '#3b82f6' }]}>REEFER</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Expanded details */}
              {isExpanded && (
                <View style={[s.detailBox, { backgroundColor: colors.muted, borderTopColor: colors.border }]}>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Name</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{item.name || '—'}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Carrier</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{item.carrier_name}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Per Kg</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{item.currency} {parseFloat(item.per_kg).toFixed(2)}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Per Km</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{item.currency} {parseFloat(item.per_km).toFixed(2)}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Min Charge</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{item.currency} {parseFloat(item.min_charge).toFixed(2)}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Cargo Type</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{item.cargo_type}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Hazmat</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{item.is_hazmat ? 'Yes' : 'No'}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Reefer</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{item.is_reefer ? 'Yes' : 'No'}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Valid From</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{formatDate(item.valid_from)}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={[s.detailLabel, { color: colors.textFaint }]}>Valid Until</Text>
                    <Text style={[s.detailValue, { color: colors.text }]}>{formatDate(item.valid_until)}</Text>
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
  statBox: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
  rateLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  rateValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  detailBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 12, fontWeight: '500' },
  detailValue: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
})
