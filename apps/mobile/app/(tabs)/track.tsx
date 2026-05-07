import { useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import CargoTrackMap, { useMapContext, type MappedShipment } from '@/components/CargoTrackMap'
import { riskLevel } from '@shared/utils/statusColors'
import { GlassCard, Skeleton } from '@/components/ui'
import BottomSheet from '@/components/ui/BottomSheet'

const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: '#2563EB',
  CUSTOMS:    '#F59E0B',
  DELAYED:    '#EF4444',
  DELIVERED:  '#16A34A',
  PENDING:    '#94A3B8',
}

type FilterKey = 'ALL' | 'IN_TRANSIT' | 'CUSTOMS' | 'DELAYED'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL',        label: 'All' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'CUSTOMS',   label: 'Customs' },
  { key: 'DELAYED',   label: 'Delayed' },
]

function FilterPills({ filter, onChange }: { filter: FilterKey; onChange: (f: FilterKey) => void }) {
  return (
    <View style={s.filterRow}>
      {FILTERS.map((f) => (
        <TouchableOpacity
          key={f.key}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(f.key) }}
          style={[s.filterPill, filter === f.key ? s.filterPillActive : s.filterPillInactive]}
          activeOpacity={0.75}
        >
          <Text style={[s.filterPillText, { color: filter === f.key ? '#fff' : '#94a3b8' }]}>
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function ShipmentRow({ item, onSelect }: { item: MappedShipment; onSelect: (s: MappedShipment) => void }) {
  const risk = riskLevel(item.delay_risk_score ?? 0)
  const color = STATUS_COLOR[item.status] ?? '#94a3b8'

  return (
    <TouchableOpacity
      onPress={() => { Haptics.selectionAsync(); onSelect(item) }}
      style={s.shipmentRow}
      activeOpacity={0.7}
    >
      <View style={[s.statusDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.trackingNumber}>{item.tracking_number}</Text>
        <Text style={s.routeText}>
          {item.route?.origin} → {item.route?.destination}
        </Text>
      </View>
      <Text style={[s.riskPct, { color: risk.color }]}>
        {Math.round((item.delay_risk_score ?? 0) * 100)}%
      </Text>
      <TouchableOpacity onPress={() => router.push(`/shipment/${item.id}`)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-forward" size={14} color="#64748b" />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

function TrackOverlay() {
  const { shipments, selectShipment, loading } = useMapContext()
  const [filter, setFilter] = useState<FilterKey>('ALL')

  const filtered = filter === 'ALL'
    ? shipments
    : shipments.filter((s) => s.status === filter)

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }} pointerEvents="box-none">
      <View style={{ flex: 1 }} pointerEvents="box-none">
        {/* Header — always dark glass over dark map */}
        <View pointerEvents="auto" style={s.headerContainer}>
          <GlassCard variant="elevated" accentColor="#3b82f6" accentPosition="left">
            <View style={s.headerContent}>
              <View>
                <Text style={s.headerTitle}>Live Track</Text>
                <Text style={s.headerSub}>
                  {loading ? 'Loading…' : `${shipments.length} active shipments`}
                </Text>
              </View>
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>LIVE</Text>
              </View>
            </View>
          </GlassCard>
        </View>

        <View pointerEvents="auto">
          <FilterPills filter={filter} onChange={setFilter} />
        </View>

        {loading ? (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <Skeleton variant="card" />
          </View>
        ) : (
          <BottomSheet snapPoints={[0.12, 0.45, 0.78]} initialSnap={1} glass>
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <FlatList
                data={filtered}
                keyExtractor={(s) => String(s.id)}
                renderItem={({ item }) => (
                  <ShipmentRow item={item} onSelect={(s) => selectShipment(s.id)} />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>No shipments in this filter</Text>
                  </View>
                }
              />
            </View>
          </BottomSheet>
        )}
      </View>
    </SafeAreaView>
  )
}

export default function TrackScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0a1929' }}>
      <CargoTrackMap />
      <TrackOverlay />
    </View>
  )
}

// All styles use light text — this overlay always sits on a dark map
const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  filterPillActive: { backgroundColor: '#f5801e' },
  filterPillInactive: { backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterPillText: { fontSize: 11, fontWeight: '700' },
  shipmentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  trackingNumber: { fontSize: 13, fontWeight: '800', color: '#e2e8f0' },
  routeText: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  riskPct: { fontSize: 11, fontWeight: '700', marginRight: 8 },
  headerContainer: { paddingHorizontal: 16, paddingTop: 16, marginBottom: 8 },
  headerContent: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#e2e8f0' },
  headerSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  liveText: { fontSize: 11, color: '#10B981', fontWeight: '700' },
})
