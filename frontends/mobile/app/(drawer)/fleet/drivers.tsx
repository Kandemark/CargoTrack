import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import ScreenHeader from '@/components/ScreenHeader'
import RequireRole from '@/components/RequireRole'

type DriverStatus = 'AVAILABLE' | 'ON_ROUTE' | 'OFF_DUTY' | 'ON_LEAVE' | 'SUSPENDED'

interface Driver {
  id: number
  driver_id: string
  full_name: string
  phone: string
  email: string
  license_number: string
  status: DriverStatus
  status_display: string
  rating: number
  completed_trips: number
  assigned_truck: string | null
}

interface DriverStats {
  total_drivers: number
  available_drivers: number
  on_route_drivers: number
  avg_rating: number
  total_completed_trips: number
}

const STATUS_COLORS: Record<DriverStatus, string> = {
  AVAILABLE: '#16a34a',
  ON_ROUTE: '#2563eb',
  OFF_DUTY: '#64748b',
  ON_LEAVE: '#eab308',
  SUSPENDED: '#ef4444',
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={12} color="#eab308" />
      ))}
    </View>
  )
}

export default function FleetDriversScreen() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [stats, setStats] = useState<DriverStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Driver | null>(null)
  const { colors, font, brand, status, radius, spacing } = useAppTheme()

  const fetchData = useCallback(async () => {
    try {
      const [driversRes, statsRes] = await Promise.all([
        apiClient.get<Driver[]>('/api/v1/fleet/drivers/'),
        apiClient.get<DriverStats>('/api/v1/fleet/stats/'),
      ])
      setDrivers(driversRes.data)
      if (statsRes.data) setStats(statsRes.data)
    } catch { /* handled by loading */ }
  }, [])

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [fetchData])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  if (selected) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={selected.full_name} subtitle={selected.driver_id} backButton />
        <View style={{ padding: spacing.md }}>
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.avatarRow}>
              <View style={[s.avatar, { backgroundColor: brand.primary }]}>
                <Text style={s.avatarText}>
                  {selected.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
              <View>
                <Text style={[s.name, { color: colors.text }]}>{selected.full_name}</Text>
                <StarRating rating={selected.rating} />
              </View>
            </View>
            {[
              ['Phone', selected.phone],
              ['Email', selected.email],
              ['License', selected.license_number],
              ['Completed Trips', String(selected.completed_trips)],
              ['Assigned Truck', selected.assigned_truck ?? 'None'],
            ].map(([label, value]) => (
              <View key={label}>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <View style={s.row}>
                  <Text style={[s.label, { color: colors.textFaint }]}>{label}</Text>
                  <Text style={[s.value, { color: colors.text }]}>{value}</Text>
                </View>
              </View>
            ))}
            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <View style={s.row}>
              <Text style={[s.label, { color: colors.textFaint }]}>Status</Text>
              <View style={[s.badge, { backgroundColor: (STATUS_COLORS[selected.status] ?? '#64748b') + '20' }]}>
                <View style={[s.dot, { backgroundColor: STATUS_COLORS[selected.status] }]} />
                <Text style={[s.badgeText, { color: STATUS_COLORS[selected.status] }]}>{selected.status_display}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <RequireRole roles={['ADMIN', 'LOGISTICS_MGR', 'DISPATCHER']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Drivers" backButton />
      <FlatList
        data={drivers}
        keyExtractor={(d) => String(d.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        ListHeaderComponent={stats ? (
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: brand.primary }]}>{stats.total_drivers}</Text>
              <Text style={[s.statLabel, { color: colors.textFaint }]}>Total</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: '#16a34a' }]}>{stats.available_drivers}</Text>
              <Text style={[s.statLabel, { color: colors.textFaint }]}>Available</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: '#2563eb' }]}>{stats.on_route_drivers}</Text>
              <Text style={[s.statLabel, { color: colors.textFaint }]}>On Route</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: '#eab308' }]}>{(stats.avg_rating ?? 0).toFixed(1)}</Text>
              <Text style={[s.statLabel, { color: colors.textFaint }]}>Avg Rating</Text>
            </View>
          </View>
        ) : null}
        ListEmptyComponent={loading ? null : (
          <View style={s.empty}>
            <Ionicons name="person-outline" size={48} color={colors.textFaint} />
            <Text style={{ fontSize: font.size.base, fontWeight: '700', color: colors.textMuted, marginTop: 12 }}>
              No drivers found
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelected(item)}
            activeOpacity={0.7}
            style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={s.cardRow}>
              <View style={[s.avatarSmall, { backgroundColor: brand.primary }]}>
                <Text style={s.avatarSmallText}>
                  {item.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: colors.text }]}>{item.full_name}</Text>
                <Text style={[s.sub, { color: colors.textMuted }]}>{item.assigned_truck ? `Truck: ${item.assigned_truck}` : 'Unassigned'} · {item.completed_trips} trips</Text>
              </View>
              <View>
                <StarRating rating={item.rating} />
                <View style={[s.badge, { backgroundColor: (STATUS_COLORS[item.status] ?? '#64748b') + '18', marginTop: 4, alignSelf: 'flex-end' }]}>
                  <View style={[s.dot, { backgroundColor: STATUS_COLORS[item.status] }]} />
                  <Text style={[s.badgeText, { color: STATUS_COLORS[item.status] }]}>{item.status_display}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  </RequireRole>
  )
}

const s = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  name: { fontSize: 17, fontWeight: '700' },
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
