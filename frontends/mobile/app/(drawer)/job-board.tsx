import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface FreightListing {
  id: number; posted_by_name: string; cargo_type: string; cargo_type_display: string; weight_kg: number
  origin: string; destination: string; pickup_date: string; delivery_date: string
  budget_min: string | null; budget_max: string | null; description: string
  requires_hazmat: boolean; requires_reefer: boolean; status: string; status_display: string
  bid_count: number; lowest_bid: number | null
}

const TABS = ['Browse', 'My Listings', 'My Bids']

export default function JobBoardScreen() {
  const [tab, setTab] = useState(0)
  const [listings, setListings] = useState<FreightListing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<FreightListing | null>(null)
  const { colors, font, brand, status, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const endpoint = tab === 0 ? '/api/v1/marketplace/listings/' : tab === 1 ? '/api/v1/marketplace/my-listings/' : '/api/v1/marketplace/my-bids/'
      const res = await apiClient.get<FreightListing[]>(endpoint)
      setListings(res.data ?? [])
    } catch { setListings([]) }
  }, [tab])

  useEffect(() => { setLoading(true); fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  if (selected) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Listing Detail" subtitle={selected.origin + ' → ' + selected.destination} backButton />
        <View style={{ padding: spacing.md }}>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{selected.cargo_type_display}</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>Posted by {selected.posted_by_name}</Text>
            <View style={[s.divider, { backgroundColor: colors.border }]} />
            {[
              ['Weight', `${selected.weight_kg.toLocaleString()} kg`],
              ['Pickup', new Date(selected.pickup_date).toLocaleDateString()],
              ['Delivery', new Date(selected.delivery_date).toLocaleDateString()],
              ['Budget', selected.budget_min ? `$${selected.budget_min} – $${selected.budget_max ?? 'open'}` : 'Open'],
              ['Bids', `${selected.bid_count}${selected.lowest_bid ? ` · Lowest: $${selected.lowest_bid}` : ''}`],
              ['Status', selected.status_display],
            ].map(([label, value], i) => (
              <View key={label}>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <View style={s.row}>
                  <Text style={[s.label, { color: colors.textFaint }]}>{label}</Text>
                  <Text style={[s.value, { color: colors.text }]}>{value}</Text>
                </View>
              </View>
            ))}
            {(selected.requires_hazmat || selected.requires_reefer) && (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                {selected.requires_hazmat && <View style={[s.tag, { backgroundColor: '#ef444418' }]}><Text style={{ fontSize: 10, fontWeight: '800', color: '#ef4444' }}>HAZMAT</Text></View>}
                {selected.requires_reefer && <View style={[s.tag, { backgroundColor: '#3b82f618' }]}><Text style={{ fontSize: 10, fontWeight: '800', color: '#3b82f6' }}>REEFER</Text></View>}
              </View>
            )}
            {selected.description ? (
              <>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 20 }}>{selected.description}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Job Board" backButton />
      <FlatList
        data={listings}
        keyExtractor={(l) => String(l.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.md, marginTop: 8, marginBottom: 4 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {TABS.map((t, i) => (
                <TouchableOpacity key={t} onPress={() => setTab(i)} style={[s.tab, { backgroundColor: tab === i ? brand.primary : colors.muted, marginRight: 8 }]}>
                  <Text style={[s.tabText, { color: tab === i ? '#fff' : colors.textMuted }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={!loading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="hammer-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No listings found</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.7} style={{ paddingHorizontal: spacing.md }}>
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.origin} → {item.destination}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.cargo_type_display} · {item.weight_kg.toLocaleString()} kg</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: brand.primary }}>
                    {item.budget_min ? `$${item.budget_min}` : 'Open'}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 2 }}>{item.bid_count} bids</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                {item.requires_hazmat && <View style={[s.tag, { backgroundColor: '#ef444418' }]}><Text style={{ fontSize: 8, fontWeight: '800', color: '#ef4444' }}>HAZMAT</Text></View>}
                {item.requires_reefer && <View style={[s.tag, { backgroundColor: '#3b82f618' }]}><Text style={{ fontSize: 8, fontWeight: '800', color: '#3b82f6' }}>REEFER</Text></View>}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  tabText: { fontSize: 13, fontWeight: '700' },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  divider: { height: 1, marginVertical: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  label: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '600' },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
})
