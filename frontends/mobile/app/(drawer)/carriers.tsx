import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface Carrier {
  id: number; code: string; name: string; status: string; status_display: string
  on_time_rate: number; rating: number; specialties: string; rate_cards_count: number
  contact_phone?: string; contact_email?: string
}

export default function CarriersScreen() {
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Carrier | null>(null)
  const { colors, font, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try { const res = await apiClient.get<Carrier[]>('/api/v1/carriers/'); setCarriers(res.data) } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  if (selected) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={selected.name} subtitle={selected.code} backButton />
        <View style={{ padding: spacing.md }}>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              ['Status', selected.status_display],
              ['On-Time Rate', `${selected.on_time_rate.toFixed(1)}%`],
              ['Rating', `${selected.rating.toFixed(1)} / 5`],
              ['Specialties', selected.specialties || 'General freight'],
              ['Rate Cards', String(selected.rate_cards_count)],
              ['Phone', selected.contact_phone || 'N/A'],
              ['Email', selected.contact_email || 'N/A'],
            ].map(([label, value], i) => (
              <View key={label}>
                {i > 0 && <View style={[s.divider, { backgroundColor: colors.border }]} />}
                <View style={s.row}>
                  <Text style={[s.label, { color: colors.textFaint }]}>{label}</Text>
                  <Text style={[s.value, { color: colors.text }]}>{value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Carriers" backButton />
      <FlatList
        data={carriers}
        keyExtractor={(c) => String(c.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="car-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No carriers found</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.7} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.cardRow}>
              <View style={[s.iconBox, { backgroundColor: colors.muted }]}>
                <Ionicons name="car-outline" size={20} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: colors.text }]}>{item.name}</Text>
                <Text style={[s.sub, { color: colors.textMuted }]}>{item.code} · {item.specialties || 'General'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.rate, { color: item.on_time_rate >= 80 ? '#16a34a' : '#eab308' }]}>{item.on_time_rate.toFixed(1)}%</Text>
                <Text style={[s.rateLabel, { color: colors.textFaint }]}>On-Time</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 2 },
  rate: { fontSize: 18, fontWeight: '800' },
  rateLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  label: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1 },
  empty: { alignItems: 'center', paddingTop: 80 },
})
