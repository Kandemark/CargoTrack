import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import AnimatedPressable from '@/components/animated/AnimatedPressable'
import AnimatedNumber from '@/components/animated/AnimatedNumber'
import ScreenWrapper from '@/components/animated/ScreenWrapper'

type TruckStatus = 'ACTIVE' | 'IDLE' | 'MAINTENANCE' | 'OFF_DUTY' | 'DECOMMISSIONED'
type FuelType = 'DIESEL' | 'PETROL' | 'ELECTRIC' | 'HYBRID' | 'CNG'

interface Truck {
  id: number
  fleet_id: string
  make: string
  model: string
  year: number
  plate: string
  vin: string | null
  color: string
  payload_tonnes: number
  engine_cc: number | null
  fuel_type: FuelType
  fuel_type_display: string
  status: TruckStatus
  status_display: string
  mileage_km: number
  assigned_driver_name: string | null
}

interface FleetStats {
  total_trucks: number
  active_trucks: number
  idle_trucks: number
  maintenance_trucks: number
  avg_payload_tonnes: number
  total_mileage_km: number
}

const STATUS_COLORS: Record<TruckStatus, string> = {
  ACTIVE: '#16a34a',
  IDLE: '#eab308',
  MAINTENANCE: '#f5801e',
  OFF_DUTY: '#64748b',
  DECOMMISSIONED: '#ef4444',
}

const FUEL_ICONS: Record<FuelType, React.ComponentProps<typeof Ionicons>['name']> = {
  DIESEL: 'flash-outline',
  PETROL: 'flame-outline',
  ELECTRIC: 'battery-charging-outline',
  HYBRID: 'git-compare-outline',
  CNG: 'leaf-outline',
}

export default function FleetTrucksScreen() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [stats, setStats] = useState<FleetStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const { colors, font, brand, radius, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const [trucksRes, statsRes] = await Promise.all([
        apiClient.get<Truck[]>('/api/v1/fleet/trucks/'),
        apiClient.get<FleetStats>('/api/v1/fleet/stats/'),
      ])
      setTrucks(trucksRes.data)
      setStats(statsRes.data)
    } catch { /* handled by loading state */ }
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  if (selectedTruck) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={selectedTruck.plate} subtitle={selectedTruck.fleet_id} backButton />
        <ScreenWrapper entrance="slide-right">
          <View style={{ padding: spacing.md }}>
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.row}>
                <Text style={[s.label, { color: colors.textFaint }]}>Make / Model</Text>
                <Text style={[s.value, { color: colors.text }]}>{selectedTruck.make} {selectedTruck.model} ({selectedTruck.year})</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.row}>
                <Text style={[s.label, { color: colors.textFaint }]}>VIN</Text>
                <Text style={[s.value, { color: colors.text }]}>{selectedTruck.vin ?? '—'}</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.row}>
                <Text style={[s.label, { color: colors.textFaint }]}>Fuel Type</Text>
                <Text style={[s.value, { color: colors.text }]}>{selectedTruck.fuel_type_display}</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.row}>
                <Text style={[s.label, { color: colors.textFaint }]}>Payload</Text>
                <Text style={[s.value, { color: colors.text }]}>{selectedTruck.payload_tonnes} tonnes</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.row}>
                <Text style={[s.label, { color: colors.textFaint }]}>Mileage</Text>
                <Text style={[s.value, { color: colors.text }]}>{selectedTruck.mileage_km.toLocaleString()} km</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.row}>
                <Text style={[s.label, { color: colors.textFaint }]}>Assigned Driver</Text>
                <Text style={[s.value, { color: colors.text }]}>{selectedTruck.assigned_driver_name ?? 'Unassigned'}</Text>
              </View>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              <View style={s.row}>
                <Text style={[s.label, { color: colors.textFaint }]}>Status</Text>
                <View style={[s.badge, { backgroundColor: (STATUS_COLORS[selectedTruck.status] ?? '#64748b') + '20' }]}>
                  <View style={[s.dot, { backgroundColor: STATUS_COLORS[selectedTruck.status] }]} />
                  <Text style={[s.badgeText, { color: STATUS_COLORS[selectedTruck.status] }]}>{selectedTruck.status_display}</Text>
                </View>
              </View>
            </View>
          </View>
        </ScreenWrapper>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Trucks" backButton />
      <ScreenWrapper entrance="fade">
        <FlatList
          data={trucks}
          keyExtractor={(t) => String(t.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          ListHeaderComponent={stats ? (
            <View style={s.statsRow}>
              <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <AnimatedNumber value={stats.total_trucks} style={[s.statValue, { color: brand.primary }]} />
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Total</Text>
              </View>
              <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <AnimatedNumber value={stats.active_trucks} style={[s.statValue, { color: '#16a34a' }]} />
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Active</Text>
              </View>
              <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <AnimatedNumber value={stats.maintenance_trucks} style={[s.statValue, { color: '#eab308' }]} />
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Maint.</Text>
              </View>
              <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statValue, { color: colors.textSecondary }]}>{stats.avg_payload_tonnes}t</Text>
                <Text style={[s.statLabel, { color: colors.textFaint }]}>Avg Payload</Text>
              </View>
            </View>
          ) : null}
          ListEmptyComponent={loading ? null : (
            <View style={s.empty}>
              <Ionicons name="car-outline" size={48} color={colors.textFaint} />
              <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>
                No trucks found
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <AnimatedPressable
              onPress={() => setSelectedTruck(item)}
              scaleTo={0.98}
              style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={s.cardRow}>
                <View style={[s.iconBox, { backgroundColor: colors.muted }]}>
                  <Ionicons name={FUEL_ICONS[item.fuel_type] ?? 'car-outline'} size={20} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: colors.text }]}>{item.plate}</Text>
                  <Text style={[s.sub, { color: colors.textMuted }]}>{item.make} {item.model} · {item.payload_tonnes}t</Text>
                </View>
                <View style={[s.badge, { backgroundColor: (STATUS_COLORS[item.status] ?? '#64748b') + '18' }]}>
                  <View style={[s.dot, { backgroundColor: STATUS_COLORS[item.status] }]} />
                  <Text style={[s.badgeText, { color: STATUS_COLORS[item.status] }]}>{item.status_display}</Text>
                </View>
              </View>
            </AnimatedPressable>
          )}
        />
      </ScreenWrapper>
    </View>
  )
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  label: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1 },
  empty: { alignItems: 'center', paddingTop: 80 },
})
