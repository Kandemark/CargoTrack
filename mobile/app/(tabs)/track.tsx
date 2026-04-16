/**
 * @file mobile/app/(tabs)/track.tsx
 * @description Track tab — full-screen CargoTrack-branded MapLibre map with
 * a draggable bottom sheet showing the live shipment list.
 *
 * Map elements:
 *   - Clustered shipment dots (ShapeSource + CircleLayer + SymbolLayer)
 *   - Route dashed lines for IN_TRANSIT shipments (LineLayer, status-coded)
 *   - Animated pulsing truck marker for selected shipment (PointAnnotation)
 *   - Floating legend overlay (bottom-left)
 *
 * Bottom sheet: draggable from collapsed (80px handle) to 45% of screen
 * height; contains filter pills and a paginated shipment FlatList.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import MapLibreGL from '@maplibre/maplibre-react-native'
import { shipmentsApi } from '@/lib/api'
import { riskLevel, SHIPMENT_STATUS_LABELS } from '@shared/utils/statusColors'
import type { ShipmentListItem, ShipmentStatus } from '@shared/api/types'

// MapLibre: no Mapbox token needed for open tile sources
MapLibreGL.setAccessToken(null)

const MAP_STYLE = require('@/assets/cargotrack-map-style.json')
const { height: SCREEN_H } = Dimensions.get('window')
const SHEET_MIN = 80
const SHEET_MAX = SCREEN_H * 0.46

// ─── Coordinate lookup ────────────────────────────────────────────────────────

const CITY_COORDS: Record<string, [number, number]> = {
  'Mombasa':       [39.6682, -4.0435],
  'Nairobi':       [36.8219, -1.2921],
  'Kampala':       [32.5825,  0.3476],
  'Kigali':        [30.0619, -1.9441],
  'Dar es Salaam': [39.2083, -6.7924],
  'Kisumu':        [34.7617, -0.1022],
  'Eldoret':       [35.2698,  0.5143],
  'Bujumbura':     [29.3644, -3.3731],
  'Juba':          [31.5713,  4.8594],
  'Dodoma':        [35.7395, -6.1731],
}

function lookupLngLat(city: string): [number, number] | null {
  const key = Object.keys(CITY_COORDS).find(
    (k) => city.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(city.toLowerCase()),
  )
  return key ? CITY_COORDS[key] : null
}

function midLngLat(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

// ─── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLOR: Partial<Record<ShipmentStatus, string>> = {
  IN_TRANSIT: '#2563EB',
  CUSTOMS:    '#F59E0B',
  DELAYED:    '#EF4444',
  DELIVERED:  '#16A34A',
  PENDING:    '#94A3B8',
}

// ─── Filter ───────────────────────────────────────────────────────────────────

type FilterKey = 'ALL' | 'IN_TRANSIT' | 'CUSTOMS' | 'DELAYED'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL',        label: 'All'       },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'CUSTOMS',   label: 'Customs'   },
  { key: 'DELAYED',   label: 'Delayed'   },
]

// ─── Enriched shipment ────────────────────────────────────────────────────────

interface MappedShipment extends ShipmentListItem {
  lngLat:     [number, number]
  originLL:   [number, number] | null
  destLL:     [number, number] | null
}

// ─── Pulsing truck marker ─────────────────────────────────────────────────────

function LiveTruckMarker({ status, onPress }: { status: ShipmentStatus; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.8, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [])

  const color = STATUS_COLOR[status as ShipmentStatus] ?? '#94a3b8'
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.markerWrap}>
      <Animated.View
        style={[styles.markerRing, {
          borderColor: color,
          transform: [{ scale: pulse }],
          opacity: pulse.interpolate({ inputRange: [1, 1.8], outputRange: [0.55, 0] }),
        }]}
      />
      <View style={[styles.markerDot, { backgroundColor: color }]}>
        <Ionicons name="car" size={13} color="#fff" />
      </View>
    </TouchableOpacity>
  )
}

// ─── Depot marker ─────────────────────────────────────────────────────────────

function DepotMarker({ type }: { type: 'origin' | 'dest' }) {
  const color = type === 'origin' ? '#2563EB' : '#16A34A'
  return (
    <View style={[styles.depotOuter, { borderColor: color }]}>
      <View style={[styles.depotInner, { backgroundColor: color }]}>
        <Ionicons name={type === 'origin' ? 'arrow-up' : 'flag'} size={10} color="#fff" />
      </View>
    </View>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <View style={styles.legend}>
      {([
        { label: 'In Transit', color: '#2563EB' },
        { label: 'Customs',    color: '#F59E0B' },
        { label: 'Delayed',    color: '#EF4444' },
      ] as const).map(({ label, color }) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
          <Text style={{ fontSize: 10, color: '#374151', fontWeight: '600' }}>{label}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

function ShipmentSheet({
  shipments,
  filter,
  onFilterChange,
  onSelect,
  loading,
}: {
  shipments: MappedShipment[]
  filter: FilterKey
  onFilterChange: (f: FilterKey) => void
  onSelect: (s: MappedShipment) => void
  loading: boolean
}) {
  const sheetY  = useRef(new Animated.Value(SHEET_MIN)).current
  const lastY   = useRef(SHEET_MIN)

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const next = Math.max(SHEET_MIN, Math.min(SHEET_MAX, lastY.current - g.dy))
        sheetY.setValue(next)
      },
      onPanResponderRelease: (_, g) => {
        const next = lastY.current - g.dy
        const snap = next > (SHEET_MIN + SHEET_MAX) / 2 ? SHEET_MAX : SHEET_MIN
        Animated.spring(sheetY, { toValue: snap, useNativeDriver: false }).start()
        lastY.current = snap
      },
    }),
  ).current

  const filtered = filter === 'ALL' ? shipments : shipments.filter((s) => s.status === filter)

  return (
    <Animated.View style={[styles.sheet, { height: sheetY }]}>
      {/* Drag handle + count */}
      <View {...pan.panHandlers} style={styles.sheetHandle}>
        <View style={styles.handleBar} />
        <Text style={styles.sheetCount}>
          {filtered.length} shipment{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onFilterChange(f.key) }}
            style={[styles.filterPill, filter === f.key && styles.filterPillActive]}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Shipment list */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color="#f5801e" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => String(s.id)}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const risk  = riskLevel(item.delay_risk_score ?? 0)
            const color = STATUS_COLOR[item.status as ShipmentStatus] ?? '#94a3b8'
            return (
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onSelect(item) }}
                style={styles.shipmentRow}
                activeOpacity={0.7}
              >
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackingNum}>{item.tracking_number}</Text>
                  <Text style={styles.routeText}>
                    {item.route?.origin} → {item.route?.destination}
                  </Text>
                </View>
                <Text style={[styles.riskPct, { color: risk.color }]}>
                  {Math.round((item.delay_risk_score ?? 0) * 100)}%
                </Text>
                <TouchableOpacity
                  onPress={() => router.push(`/shipment/${item.id}`)}
                  style={styles.detailBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                </TouchableOpacity>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>No shipments in this filter</Text>
            </View>
          }
        />
      )}
    </Animated.View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrackScreen() {
  const cameraRef = useRef<MapLibreGL.Camera>(null)

  const [shipments, setShipments]   = useState<MappedShipment[]>([])
  const [filter, setFilter]         = useState<FilterKey>('ALL')
  const [selected, setSelected]     = useState<MappedShipment | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tRes, cRes, dRes] = await Promise.all([
        shipmentsApi.list({ status: 'IN_TRANSIT', page_size: 50 }),
        shipmentsApi.list({ status: 'CUSTOMS',    page_size: 50 }),
        shipmentsApi.list({ status: 'DELAYED',    page_size: 50 }),
      ])
      const all: ShipmentListItem[] = [
        ...(Array.isArray(tRes.data) ? tRes.data : (tRes.data as any).results ?? []),
        ...(Array.isArray(cRes.data) ? cRes.data : (cRes.data as any).results ?? []),
        ...(Array.isArray(dRes.data) ? dRes.data : (dRes.data as any).results ?? []),
      ]
      const enriched: MappedShipment[] = all.map((s) => {
        const originLL = lookupLngLat(s.route?.origin ?? '')
        const destLL   = lookupLngLat(s.route?.destination ?? '')
        const lngLat   = originLL
          ? (destLL ? midLngLat(originLL, destLL) : originLL)
          : [36.8219, -1.2921] as [number, number]
        return { ...s, lngLat, originLL, destLL }
      })
      setShipments(enriched)
    } catch {
      setError('Failed to load shipments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function selectShipment(s: MappedShipment) {
    setSelected(s)
    cameraRef.current?.flyTo(s.lngLat, 600)
    cameraRef.current?.zoomTo(9)
  }

  // GeoJSON for clustered markers
  const clusterGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: shipments.map((s) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: s.lngLat },
      properties: { id: s.id, status: s.status, risk: s.delay_risk_score ?? 0 },
    })),
  }

  // GeoJSON for route lines (IN_TRANSIT only)
  const routeGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: shipments
      .filter((s) => s.status === 'IN_TRANSIT' && s.originLL && s.destLL)
      .map((s) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: [s.originLL!, s.destLL!],
        },
        properties: { id: s.id },
      })),
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <View style={{ flex: 1 }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Live Track</Text>
            <Text style={styles.headerSub}>
              {loading ? 'Loading…' : `${shipments.length} active corridor shipments`}
            </Text>
          </View>
          <TouchableOpacity onPress={load} style={styles.refreshBtn} activeOpacity={0.7}>
            <Ionicons name="refresh" size={18} color={loading ? '#5d87b5' : '#fff'} />
          </TouchableOpacity>
        </View>

        {/* ── Map + Sheet ─────────────────────────────────────────────── */}
        <View style={{ flex: 1 }}>
          {error ? (
            <View style={styles.errorView}>
              <Ionicons name="cloud-offline-outline" size={44} color="#94a3b8" />
              <Text style={{ color: '#64748b', marginTop: 12 }}>{error}</Text>
              <TouchableOpacity onPress={load} style={styles.retryBtn}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MapLibreGL.MapView
              style={{ flex: 1 }}
              styleJSON={JSON.stringify(MAP_STYLE)}
              compassEnabled
              logoEnabled={false}
              attributionEnabled={false}
            >
              <MapLibreGL.Camera
                ref={cameraRef}
                zoomLevel={5}
                centerCoordinate={[35.0, -1.5]}
                animationDuration={0}
              />

              {/* Route lines */}
              <MapLibreGL.ShapeSource id="routes" shape={routeGeoJSON}>
                <MapLibreGL.LineLayer
                  id="route-lines"
                  style={{
                    lineColor: '#2563EB',
                    lineWidth: 2,
                    lineOpacity: 0.55,
                    lineDasharray: [5, 3],
                  }}
                />
              </MapLibreGL.ShapeSource>

              {/* Clustered shipment dots */}
              <MapLibreGL.ShapeSource
                id="shipments"
                shape={clusterGeoJSON}
                cluster
                clusterRadius={48}
                clusterMaxZoom={11}
                onPress={(e) => {
                  const props = e.features[0]?.properties
                  if (!props || props.point_count) return
                  const hit = shipments.find((s) => s.id === props.id)
                  if (hit) selectShipment(hit)
                }}
              >
                {/* Cluster circle */}
                <MapLibreGL.CircleLayer
                  id="clusters"
                  filter={['has', 'point_count']}
                  style={{
                    circleRadius: ['interpolate', ['linear'], ['get', 'point_count'], 1, 18, 20, 28],
                    circleColor: '#0f2d5e',
                    circleOpacity: 0.9,
                    circleStrokeWidth: 2,
                    circleStrokeColor: '#fff',
                  }}
                />
                {/* Cluster count */}
                <MapLibreGL.SymbolLayer
                  id="cluster-count"
                  filter={['has', 'point_count']}
                  style={{
                    textField: ['get', 'point_count_abbreviated'],
                    textSize: 12,
                    textColor: '#fff',
                    textFont: ['Open Sans Bold'],
                  }}
                />
                {/* Individual dot */}
                <MapLibreGL.CircleLayer
                  id="unclustered"
                  filter={['!', ['has', 'point_count']]}
                  style={{
                    circleRadius: 8,
                    circleColor: [
                      'match', ['get', 'status'],
                      'IN_TRANSIT', '#2563EB',
                      'CUSTOMS',    '#F59E0B',
                      'DELAYED',    '#EF4444',
                      '#94a3b8',
                    ],
                    circleStrokeWidth: 2,
                    circleStrokeColor: '#fff',
                    circleOpacity: 0.9,
                  }}
                />
              </MapLibreGL.ShapeSource>

              {/* Selected shipment — animated truck marker */}
              {selected && (
                <MapLibreGL.PointAnnotation
                  id="selected"
                  coordinate={selected.lngLat}
                >
                  <LiveTruckMarker
                    status={selected.status as ShipmentStatus}
                    onPress={() => router.push(`/shipment/${selected.id}`)}
                  />
                </MapLibreGL.PointAnnotation>
              )}

              {/* Origin / dest depot markers for selected */}
              {selected?.originLL && (
                <MapLibreGL.PointAnnotation id="origin" coordinate={selected.originLL}>
                  <DepotMarker type="origin" />
                </MapLibreGL.PointAnnotation>
              )}
              {selected?.destLL && (
                <MapLibreGL.PointAnnotation id="dest" coordinate={selected.destLL}>
                  <DepotMarker type="dest" />
                </MapLibreGL.PointAnnotation>
              )}
            </MapLibreGL.MapView>
          )}

          <Legend />

          <ShipmentSheet
            shipments={shipments}
            filter={filter}
            onFilterChange={setFilter}
            onSelect={selectShipment}
            loading={loading}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#0f2d5e',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub:   { color: '#93b4d8', fontSize: 12, marginTop: 1 },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  errorView: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retryBtn: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: '#0f2d5e', borderRadius: 10,
  },

  // Markers
  markerWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  markerRing: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    borderWidth: 2,
  },
  markerDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3,
  },
  depotOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  depotInner: {
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },

  // Legend
  legend: {
    position: 'absolute', bottom: SHEET_MIN + 12, left: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10, padding: 10,
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3,
  },

  // Sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -3 }, shadowRadius: 10, elevation: 10,
  },
  sheetHandle: { alignItems: 'center', paddingVertical: 10 },
  handleBar:   { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' },
  sheetCount:  { fontSize: 11, fontWeight: '700', color: '#6b7280', marginTop: 4 },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 12,
    paddingBottom: 10, flexWrap: 'wrap', gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: { backgroundColor: '#0f2d5e' },
  filterLabel:      { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  filterLabelActive:{ color: '#fff' },

  // Shipment rows
  shipmentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  trackingNum: { fontSize: 13, fontWeight: '700', color: '#111827' },
  routeText:   { fontSize: 11, color: '#6b7280', marginTop: 1 },
  riskPct:     { fontSize: 12, fontWeight: '700', marginRight: 4 },
  detailBtn:   { padding: 4 },
})
