import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker, Polyline, Callout, PROVIDER_DEFAULT } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { shipmentsApi } from '@/lib/api'
import { riskLevel, SHIPMENT_STATUS_LABELS } from '@shared/utils/statusColors'
import type { ShipmentListItem, ShipmentStatus, TrackingEvent } from '@shared/api/types'

const { height: SCREEN_H } = Dimensions.get('window')
const SHEET_MIN  = 72
const SHEET_MAX  = SCREEN_H * 0.45

// ─── Corridor coordinate lookup ───────────────────────────────────────────────

const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  'Mombasa':       { latitude: -4.0435,  longitude: 39.6682 },
  'Nairobi':       { latitude: -1.2921,  longitude: 36.8219 },
  'Kampala':       { latitude:  0.3476,  longitude: 32.5825 },
  'Kigali':        { latitude: -1.9441,  longitude: 30.0619 },
  'Dar es Salaam': { latitude: -6.7924,  longitude: 39.2083 },
  'Kisumu':        { latitude: -0.1022,  longitude: 34.7617 },
  'Eldoret':       { latitude:  0.5143,  longitude: 35.2698 },
  'Bujumbura':     { latitude: -3.3731,  longitude: 29.3644 },
  'Juba':          { latitude:  4.8594,  longitude: 31.5713 },
  'Dodoma':        { latitude: -6.1731,  longitude: 35.7395 },
}

function lookupCoords(city: string) {
  // Fuzzy: check if any key is contained in the city string
  const key = Object.keys(CITY_COORDS).find((k) =>
    city.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(city.toLowerCase()),
  )
  return key ? CITY_COORDS[key] : null
}

// Midpoint between two coords (for marker placement when no events)
function midpoint(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  return { latitude: (a.latitude + b.latitude) / 2, longitude: (a.longitude + b.longitude) / 2 }
}

const INITIAL_REGION = {
  latitude:        -1.5,
  longitude:       35.0,
  latitudeDelta:   12,
  longitudeDelta:  14,
}

// ─── Status marker color ──────────────────────────────────────────────────────

const MARKER_COLOR: Partial<Record<ShipmentStatus, string>> = {
  IN_TRANSIT: '#3b82f6',
  CUSTOMS:    '#f59e0b',
  DELAYED:    '#ef4444',
}

// ─── Filter options ───────────────────────────────────────────────────────────

type FilterKey = 'ALL' | 'IN_TRANSIT' | 'CUSTOMS' | 'DELAYED'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL',       label: 'All'       },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'CUSTOMS',   label: 'Customs'   },
  { key: 'DELAYED',   label: 'Delayed'   },
]

// ─── Enriched shipment: has resolved coordinates ──────────────────────────────

interface MappedShipment extends ShipmentListItem {
  markerCoords: { latitude: number; longitude: number }
  originCoords:  { latitude: number; longitude: number } | null
  destCoords:    { latitude: number; longitude: number } | null
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

function BottomSheet({
  shipments,
  onSelectShipment,
}: {
  shipments: MappedShipment[]
  onSelectShipment: (s: MappedShipment) => void
}) {
  const sheetY = useRef(new Animated.Value(SHEET_MIN)).current
  const lastY  = useRef(SHEET_MIN)

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
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

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: sheetY,
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: -3 },
        shadowRadius: 10,
        elevation: 10,
      }}
    >
      {/* Drag handle */}
      <View {...panResponder.panHandlers} style={{ paddingVertical: 10, alignItems: 'center' }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' }} />
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', marginTop: 4 }}>
          {shipments.length} active shipment{shipments.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={shipments}
        keyExtractor={(s) => String(s.id)}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
        renderItem={({ item }) => {
          const risk = riskLevel(item.delay_risk_score ?? 0)
          return (
            <TouchableOpacity
              onPress={() => onSelectShipment(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
              }}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 10, height: 10, borderRadius: 5,
                  backgroundColor: MARKER_COLOR[item.status as ShipmentStatus] ?? '#94a3b8',
                  marginRight: 10,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
                  {item.tracking_number}
                </Text>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>
                  {item.route?.origin} → {item.route?.destination}
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: risk.color }}>
                {Math.round((item.delay_risk_score ?? 0) * 100)}%
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#cbd5e1" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Text style={{ color: '#94a3b8', fontSize: 13 }}>No active shipments</Text>
          </View>
        }
      />
    </Animated.View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const mapRef = useRef<MapView>(null)
  const [shipments, setShipments]   = useState<MappedShipment[]>([])
  const [filter, setFilter]         = useState<FilterKey>('ALL')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch IN_TRANSIT, CUSTOMS, DELAYED in parallel
      const [transitRes, customsRes, delayedRes] = await Promise.all([
        shipmentsApi.list({ status: 'IN_TRANSIT', page_size: 50 }),
        shipmentsApi.list({ status: 'CUSTOMS',    page_size: 50 }),
        shipmentsApi.list({ status: 'DELAYED',    page_size: 50 }),
      ])

      const all: ShipmentListItem[] = [
        ...(Array.isArray(transitRes.data) ? transitRes.data : (transitRes.data as any).results ?? []),
        ...(Array.isArray(customsRes.data)  ? customsRes.data  : (customsRes.data as any).results ?? []),
        ...(Array.isArray(delayedRes.data)  ? delayedRes.data  : (delayedRes.data as any).results ?? []),
      ]

      // Enrich with latest tracking event coordinates
      const enriched = await Promise.all(
        all.map(async (s): Promise<MappedShipment> => {
          const originCoords = lookupCoords(s.route?.origin ?? '')
          const destCoords   = lookupCoords(s.route?.destination ?? '')

          let markerCoords = originCoords ?? { latitude: -1.2921, longitude: 36.8219 }

          try {
            const evRes = await shipmentsApi.trackingEvents(s.id, { page: 1 })
            const events: TrackingEvent[] = Array.isArray(evRes.data)
              ? evRes.data
              : (evRes.data as any).results ?? []
            if (events.length > 0) {
              // Latest event — try to parse location as city name
              const latest = events[0]
              const coords = lookupCoords(latest.location)
              if (coords) markerCoords = coords
              else if (originCoords && destCoords) markerCoords = midpoint(originCoords, destCoords)
            } else if (originCoords && destCoords) {
              markerCoords = midpoint(originCoords, destCoords)
            }
          } catch {
            // keep default
          }

          return { ...s, markerCoords, originCoords, destCoords }
        }),
      )

      setShipments(enriched)
    } catch {
      setError('Failed to load map data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'ALL' ? shipments : shipments.filter((s) => s.status === filter)

  function panToShipment(s: MappedShipment) {
    mapRef.current?.animateToRegion({
      latitude:      s.markerCoords.latitude,
      longitude:     s.markerCoords.longitude,
      latitudeDelta: 1.5,
      longitudeDelta: 1.5,
    }, 600)
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <View style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ backgroundColor: '#0f2d5e', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Live Map</Text>
          <TouchableOpacity onPress={load} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="refresh" size={20} color={loading ? '#5d87b5' : '#93b4d8'} />
          </TouchableOpacity>
        </View>

        {/* Filter pills */}
        <View style={{ backgroundColor: '#0f2d5e', paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row' }}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                marginRight: 8,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 20,
                backgroundColor: filter === f.key ? '#f5801e' : 'rgba(255,255,255,0.12)',
              }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: filter === f.key ? '#fff' : '#93b4d8' }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Map */}
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
              <ActivityIndicator size="large" color="#f5801e" />
              <Text style={{ color: '#94a3b8', marginTop: 12 }}>Loading shipments…</Text>
            </View>
          ) : error ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="cloud-offline-outline" size={44} color="#94a3b8" />
              <Text style={{ color: '#64748b', marginTop: 12 }}>{error}</Text>
              <TouchableOpacity onPress={load} style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#0f2d5e', borderRadius: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              provider={PROVIDER_DEFAULT}
              style={{ flex: 1 }}
              initialRegion={INITIAL_REGION}
              showsUserLocation={false}
              showsCompass
            >
              {filtered.map((s) => (
                <Marker
                  key={s.id}
                  coordinate={s.markerCoords}
                  pinColor={MARKER_COLOR[s.status as ShipmentStatus] ?? '#94a3b8'}
                >
                  <Callout onPress={() => router.push(`/shipment/${s.id}`)}>
                    <View style={{ width: 200, padding: 4 }}>
                      <Text style={{ fontWeight: '700', fontSize: 13 }}>{s.tracking_number}</Text>
                      <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.carrier_name}</Text>
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>
                        {SHIPMENT_STATUS_LABELS[s.status as keyof typeof SHIPMENT_STATUS_LABELS] ?? s.status}
                      </Text>
                      <Text style={{ fontSize: 11, color: riskLevel(s.delay_risk_score ?? 0).color, marginTop: 2, fontWeight: '700' }}>
                        Risk: {Math.round((s.delay_risk_score ?? 0) * 100)}%
                      </Text>
                      <Text style={{ fontSize: 10, color: '#3b82f6', marginTop: 4 }}>Tap to open →</Text>
                    </View>
                  </Callout>
                </Marker>
              ))}

              {/* Route lines for IN_TRANSIT */}
              {filtered
                .filter((s) => s.status === 'IN_TRANSIT' && s.originCoords && s.destCoords)
                .map((s) => (
                  <Polyline
                    key={`route-${s.id}`}
                    coordinates={[s.originCoords!, s.destCoords!]}
                    strokeColor="#3b82f666"
                    strokeWidth={2}
                    lineDashPattern={[8, 6]}
                  />
                ))}
            </MapView>
          )}

          {/* Bottom sheet — only when not loading/error */}
          {!loading && !error && (
            <BottomSheet shipments={filtered} onSelectShipment={panToShipment} />
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}
