import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface PODPhoto { id: number; file_url: string; description: string }
interface POD {
  id: number; shipment_id: number; tracking_number: string; delivered_at: string | null
  verification_status: 'VERIFIED' | 'UNVERIFIED' | 'DISPUTED'; verification_status_display: string
  condition: 'GOOD' | 'DAMAGED' | 'SHORT' | 'REFUSED'; condition_display: string
  receiver_name: string; receiver_signature_url: string | null; photos: PODPhoto[]; notes: string | null
}

const STATUS_COLORS: Record<string, string> = { VERIFIED: '#16a34a', UNVERIFIED: '#eab308', DISPUTED: '#ef4444' }
const CONDITION_COLORS: Record<string, string> = { GOOD: '#16a34a', DAMAGED: '#f5801e', SHORT: '#ef4444', REFUSED: '#dc2626' }

export default function PODScreen() {
  const [pods, setPods] = useState<POD[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<POD | null>(null)
  const { colors, font, status, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try { const res = await apiClient.get<POD[]>('/api/v1/pod/pod/'); setPods(res.data) } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  if (selected) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={selected.tracking_number} subtitle="Proof of Delivery" backButton />
        <View style={{ padding: spacing.md }}>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              ['Status', selected.verification_status_display, STATUS_COLORS[selected.verification_status]],
              ['Condition', selected.condition_display, CONDITION_COLORS[selected.condition]],
              ['Receiver', selected.receiver_name, null],
              ['Delivered', selected.delivered_at ? new Date(selected.delivered_at).toLocaleString() : 'Pending', null],
              ['Notes', selected.notes || 'None', null],
            ].map(([label, value, color], i) => (
              <View key={label}>
                {i > 0 && <View style={[s.divider, { backgroundColor: colors.border }]} />}
                <View style={s.row}>
                  <Text style={[s.label, { color: colors.textFaint }]}>{label}</Text>
                  <Text style={[s.value, { color: color ? color : colors.text }]}>{value}</Text>
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
      <ScreenHeader title="Proof of Delivery" backButton />
      <FlatList
        data={pods}
        keyExtractor={(p) => String(p.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="checkmark-done-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No POD records</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.7} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.cardRow}>
              <View style={[s.iconBox, { backgroundColor: (STATUS_COLORS[item.verification_status] ?? '#64748b') + '18' }]}>
                <Ionicons name="checkmark-done-outline" size={20} color={STATUS_COLORS[item.verification_status]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.tracking_number}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.receiver_name} · {item.condition_display}</Text>
              </View>
              <View>
                <View style={[s.badge, { backgroundColor: (STATUS_COLORS[item.verification_status] ?? '#64748b') + '18' }]}>
                  <Text style={[s.badgeText, { color: STATUS_COLORS[item.verification_status] }]}>{item.verification_status_display}</Text>
                </View>
                {item.delivered_at && (
                  <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 4, textAlign: 'right' }}>{new Date(item.delivered_at).toLocaleDateString()}</Text>
                )}
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
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  label: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1 },
  empty: { alignItems: 'center', paddingTop: 80 },
})
