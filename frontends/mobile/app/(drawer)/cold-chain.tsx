import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'

interface TempReading { timestamp: string; temperature_c: number; location: string }
interface TempExcursion { start_time: string; end_time: string | null; duration_minutes: number; min_temp_c: number; max_temp_c: number }
interface ColdChainCertificate { certificate_id: string; issued_at: string; valid_until: string; compliance: boolean }
interface ColdChainShipment {
  id: number; shipment_id: number; tracking_number: string
  product_type: string; product_type_display: string
  temp_min_c: number; temp_max_c: number
  monitoring_device_id: string
  active_excursion: boolean
  current_temp_c: number | null; last_reading_at: string | null
  certificate: ColdChainCertificate | null
}

export default function ColdChainScreen() {
  const [shipments, setShipments] = useState<ColdChainShipment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<ColdChainShipment | null>(null)
  const [readings, setReadings] = useState<TempReading[]>([])
  const { colors, font, brand, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try { const res = await apiClient.get<ColdChainShipment[]>('/api/v1/coldchain/'); setShipments(res.data) } catch {}
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])
  async function handleRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  async function showDetail(item: ColdChainShipment) {
    setSelected(item)
    try {
      const res = await apiClient.get<{ readings: TempReading[] }>(`/api/v1/coldchain/${item.id}/compliance-report/`)
      setReadings(res.data.readings ?? [])
    } catch { setReadings([]) }
  }

  if (selected) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={selected.tracking_number} subtitle={selected.product_type_display} backButton />
        <View style={{ padding: spacing.md }}>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: colors.text }]}>{selected.product_type_display}</Text>
                <Text style={[s.sub, { color: colors.textMuted }]}>Device: {selected.monitoring_device_id}</Text>
              </View>
              {selected.active_excursion ? (
                <View style={[s.badge, { backgroundColor: '#ef444420' }]}>
                  <Ionicons name="warning" size={14} color="#ef4444" />
                  <Text style={[s.badgeText, { color: '#ef4444' }]}>Excursion</Text>
                </View>
              ) : (
                <View style={[s.badge, { backgroundColor: '#16a34a20' }]}>
                  <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                  <Text style={[s.badgeText, { color: '#16a34a' }]}>Stable</Text>
                </View>
              )}
            </View>
            <View style={[s.divider, { backgroundColor: colors.border, marginTop: 12 }]} />
            {[
              ['Range', `${selected.temp_min_c}°C – ${selected.temp_max_c}°C`],
              ['Current', selected.current_temp_c != null ? `${selected.current_temp_c.toFixed(1)}°C` : 'N/A'],
              ['Last Reading', selected.last_reading_at ? new Date(selected.last_reading_at).toLocaleString() : 'N/A'],
            ].map(([label, value], i) => (
              <View key={label}>
                {i > 0 && <View style={[s.divider, { backgroundColor: colors.border }]} />}
                <View style={s.row}>
                  <Text style={[s.label, { color: colors.textFaint }]}>{label}</Text>
                  <Text style={[s.value, { color: colors.text }]}>{value}</Text>
                </View>
              </View>
            ))}
            {selected.certificate && (
              <>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <View style={s.row}>
                  <Text style={[s.label, { color: colors.textFaint }]}>Certificate</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.value, { color: colors.text }]}>{selected.certificate.certificate_id}</Text>
                    <Text style={{ fontSize: 11, color: selected.certificate.compliance ? '#16a34a' : '#ef4444', fontWeight: '600' }}>
                      {selected.certificate.compliance ? 'Compliant' : 'Non-Compliant'}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {readings.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: colors.text, marginTop: 16 }]}>Recent Readings</Text>
              {readings.slice(0, 10).map((r, i) => (
                <View key={i} style={[s.readingRow, { borderBottomColor: colors.border }]}>
                  <Text style={[s.readingTime, { color: colors.textFaint }]}>{new Date(r.timestamp).toLocaleTimeString()}</Text>
                  <Text style={[s.readingLoc, { color: colors.textMuted }]}>{r.location}</Text>
                  <Text style={[s.readingTemp, { color: r.temperature_c > selected.temp_max_c || r.temperature_c < selected.temp_min_c ? '#ef4444' : '#16a34a' }]}>
                    {r.temperature_c.toFixed(1)}°C
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Cold Chain" backButton />
      <FlatList
        data={shipments}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="thermometer-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>No cold chain shipments</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => showDetail(item)} activeOpacity={0.7} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.cardRow}>
              <View style={[s.iconBox, { backgroundColor: item.active_excursion ? '#ef444418' : '#16a34a18' }]}>
                <Ionicons name="thermometer-outline" size={20} color={item.active_excursion ? '#ef4444' : '#16a34a'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: colors.text }]}>{item.tracking_number}</Text>
                <Text style={[s.sub, { color: colors.textMuted }]}>{item.product_type_display}</Text>
              </View>
              <Text style={[s.temp, { color: colors.text }]}>
                {item.current_temp_c != null ? `${item.current_temp_c.toFixed(1)}°C` : '--'}
              </Text>
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
  temp: { fontSize: 16, fontWeight: '800' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  label: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  readingRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  readingTime: { fontSize: 12, width: 80 },
  readingLoc: { fontSize: 12, flex: 1 },
  readingTemp: { fontSize: 13, fontWeight: '700', width: 50, textAlign: 'right' },
  empty: { alignItems: 'center', paddingTop: 80 },
})
