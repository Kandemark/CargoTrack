import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapLibreGL from '@maplibre/maplibre-react-native'
import Svg, { Path } from 'react-native-svg'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import {
  SHIPMENT_STATUS_COLORS,
  SHIPMENT_STATUS_LABELS,
  riskLevel,
} from '@shared/utils/statusColors'
import { formatDate, formatDateTime, formatWeight, timeAgo } from '@shared/utils/formatters'
import type { Shipment, TrackingEvent, ShipmentStatus, EventType } from '@shared/api/types'

const { width: SCREEN_W } = Dimensions.get('window')

// ─── Coordinate lookup (mirrors map.tsx) ──────────────────────────────────────

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
  const key = Object.keys(CITY_COORDS).find((k) =>
    city.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(city.toLowerCase()),
  )
  return key ? CITY_COORDS[key] : null
}

function midCoords(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  return { latitude: (a.latitude + b.latitude) / 2, longitude: (a.longitude + b.longitude) / 2 }
}

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_BORDER_COLOR: Record<EventType, string> = {
  DEPARTURE:     '#3b82f6',
  CHECKPOINT:    '#94a3b8',
  CUSTOMS_ENTRY: '#f59e0b',
  CUSTOMS_CLEAR: '#f59e0b',
  ARRIVAL:       '#10b981',
  DELAY:         '#ef4444',
  NOTE:          '#94a3b8',
}

const EVENT_ICONS: Record<EventType, React.ComponentProps<typeof Ionicons>['name']> = {
  DEPARTURE:     'airplane',
  CHECKPOINT:    'location',
  CUSTOMS_ENTRY: 'document-text',
  CUSTOMS_CLEAR: 'checkmark-done',
  ARRIVAL:       'flag',
  DELAY:         'warning',
  NOTE:          'chatbubble-outline',
}

// ─── Delay risk arc ───────────────────────────────────────────────────────────

function RiskGauge({ score }: { score: number }) {
  // Draw a 180° semicircle arc (bottom half flat)
  const size   = 140
  const stroke = 12
  const r      = (size - stroke) / 2
  const cx     = size / 2
  const cy     = size / 2

  // Arc from 180° to (180 + 180*score)° — left-to-right along top
  const pct    = Math.min(Math.max(score, 0), 1)
  const color  = riskLevel(score).color

  // Full semicircle track: left edge (180°) to right edge (0°)
  const trackD = `M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`

  // Filled arc: same start, sweep pct of 180°
  const angleDeg = 180 * pct
  const angleRad = ((180 - angleDeg) * Math.PI) / 180  // from left (180°)
  const x2 = cx + r * Math.cos(angleRad)
  const y2 = cy - r * Math.sin(angleRad)
  const largeArc = angleDeg > 180 ? 1 : 0
  const arcD = pct > 0
    ? `M ${stroke / 2} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
    : ''

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size / 2 + 10, overflow: 'hidden' }}>
        <Svg width={size} height={size}>
          {/* Track */}
          <Path
            d={trackD}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Arc */}
          {arcD ? (
            <Path
              d={arcD}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          ) : null}
        </Svg>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color, marginTop: -6 }}>
        {Math.round(score * 100)}%
      </Text>
      <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
        Delay Risk · {riskLevel(score).label}
      </Text>
    </View>
  )
}

// MapLibre token not needed for open tile sources
MapLibreGL.setAccessToken(null)
const MAP_STYLE = require('@/assets/cargotrack-map-style.json')

// ─── Mini map (MapLibre) ──────────────────────────────────────────────────────

function MiniMap({
  shipment,
  events,
}: {
  shipment: Shipment
  events: TrackingEvent[]
}) {
  const originCoords = lookupCoords(shipment.route.origin)
  const destCoords   = lookupCoords(shipment.route.destination)

  // Convert to [lng, lat] (GeoJSON order) for MapLibre
  const origin = originCoords ? [originCoords.longitude, originCoords.latitude] as [number,number] : null
  const dest   = destCoords   ? [destCoords.longitude,   destCoords.latitude  ] as [number,number] : null

  let markerLL: [number, number] = origin ?? [36.8219, -1.2921]
  if (events.length > 0) {
    const latest = lookupCoords(events[0].location)
    if (latest) markerLL = [latest.longitude, latest.latitude]
    else if (origin && dest) markerLL = [(origin[0]+dest[0])/2, (origin[1]+dest[1])/2]
  } else if (origin && dest) {
    markerLL = [(origin[0]+dest[0])/2, (origin[1]+dest[1])/2]
  }

  const routeGeoJSON: GeoJSON.FeatureCollection | null = origin && dest ? {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [origin, dest] },
      properties: {},
    }],
  } : null

  return (
    <View style={{ height: 180, borderRadius: 16, overflow: 'hidden' }}>
      <MapLibreGL.MapView
        style={{ flex: 1 }}
        styleJSON={JSON.stringify(MAP_STYLE)}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapLibreGL.Camera
          zoomLevel={6}
          centerCoordinate={markerLL}
          animationDuration={0}
        />

        {routeGeoJSON && (
          <MapLibreGL.ShapeSource id="route" shape={routeGeoJSON}>
            <MapLibreGL.LineLayer
              id="route-line"
              style={{ lineColor: '#2563EB', lineWidth: 2, lineOpacity: 0.55, lineDasharray: [5, 3] }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Current position marker */}
        <MapLibreGL.PointAnnotation id="current" coordinate={markerLL}>
          <View style={{
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: '#f5801e', borderWidth: 2.5, borderColor: '#fff',
            shadowColor: '#000', shadowOpacity: 0.2,
            shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3,
          }} />
        </MapLibreGL.PointAnnotation>

        {origin && (
          <MapLibreGL.PointAnnotation id="origin" coordinate={origin}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#fff' }} />
          </MapLibreGL.PointAnnotation>
        )}
        {dest && (
          <MapLibreGL.PointAnnotation id="dest" coordinate={dest}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#16A34A', borderWidth: 2, borderColor: '#fff' }} />
          </MapLibreGL.PointAnnotation>
        )}
      </MapLibreGL.MapView>
    </View>
  )
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, margin: 4 }}>
      <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 3 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{sub}</Text> : null}
    </View>
  )
}

// ─── Timeline event ───────────────────────────────────────────────────────────

function TimelineEvent({ event, isLast }: { event: TrackingEvent; isLast: boolean }) {
  const color    = EVENT_BORDER_COLOR[event.event_type as EventType] ?? '#94a3b8'
  const iconName = EVENT_ICONS[event.event_type as EventType] ?? 'ellipse'

  return (
    <View style={{ flexDirection: 'row', marginBottom: isLast ? 0 : 12 }}>
      {/* Spine */}
      <View style={{ width: 32, alignItems: 'center' }}>
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: `${color}22`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={iconName} size={13} color={color} />
        </View>
        {!isLast && (
          <View style={{ width: 2, flex: 1, backgroundColor: '#e5e7eb', marginTop: 2, minHeight: 16 }} />
        )}
      </View>

      {/* Content */}
      <View style={{
        flex: 1, marginLeft: 10, paddingBottom: isLast ? 0 : 4,
        borderLeftWidth: 0,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
            {event.event_type_display}
          </Text>
          <Text style={{ fontSize: 10, color: '#9ca3af' }}>{timeAgo(event.timestamp)}</Text>
        </View>
        <Text style={{ fontSize: 12, color: '#6b7280' }}>{event.location}</Text>
        <Text style={{ fontSize: 10, color: '#9ca3af' }}>{formatDateTime(event.timestamp)}</Text>
        {event.notes ? (
          <Text style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginTop: 3 }}>
            {event.notes}
          </Text>
        ) : null}
        {event.recorded_by_name ? (
          <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>by {event.recorded_by_name}</Text>
        ) : null}
      </View>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const CAN_LOG_EVENTS = ['ADMIN', 'LOGISTICS_MGR', 'CARRIER']

export default function ShipmentDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>()
  const userRole = useAuthStore((s) => s.user?.role)

  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [events, setEvents]     = useState<TrackingEvent[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!id) return
    const numId = Number(id)
    Promise.all([
      shipmentsApi.get(numId),
      shipmentsApi.trackingEvents(numId),
    ])
      .then(([shRes, evRes]) => {
        setShipment(shRes.data)
        const raw = evRes.data
        const list: TrackingEvent[] = Array.isArray(raw) ? raw : (raw as any).results ?? []
        // newest first
        setEvents([...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
      })
      .catch(() => {
        Alert.alert('Error', 'Could not load shipment details.')
        router.back()
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#f5801e" />
      </View>
    )
  }

  if (!shipment) return null

  const sc      = SHIPMENT_STATUS_COLORS[shipment.status as ShipmentStatus] ?? SHIPMENT_STATUS_COLORS.PENDING
  const label   = SHIPMENT_STATUS_LABELS[shipment.status as ShipmentStatus] ?? shipment.status
  const canLog  = userRole && CAN_LOG_EVENTS.includes(userRole)

  // Arrival delta
  let arrivalDelta: string | null = null
  if (shipment.actual_arrival && shipment.scheduled_arrival) {
    const diffMs    = new Date(shipment.actual_arrival).getTime() - new Date(shipment.scheduled_arrival).getTime()
    const diffHours = Math.round(diffMs / 3_600_000)
    if (diffHours > 0) arrivalDelta = `+${diffHours}h late`
    else if (diffHours < 0) arrivalDelta = `${Math.abs(diffHours)}h early`
    else arrivalDelta = 'On time'
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <ScrollView style={{ flex: 1, backgroundColor: '#f1f5f9' }} showsVerticalScrollIndicator={false}>

        {/* ── Hero header ────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: '#0f2d5e', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 }}>
          {/* Back + Log Event row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-back" size={18} color="#93b4d8" />
              <Text style={{ color: '#93c5fd', fontSize: 13, marginLeft: 2 }}>Back</Text>
            </TouchableOpacity>
            {canLog && (
              <TouchableOpacity
                onPress={() => router.push(`/shipment/log-event?id=${shipment.id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5801e', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}
              >
                <Ionicons name="add-circle-outline" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 5 }}>Log Event</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tracking # + route */}
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>
            {shipment.tracking_number}
          </Text>
          <Text style={{ color: '#93c5fd', fontSize: 13, marginTop: 3 }}>
            {shipment.route.origin} → {shipment.route.destination}
          </Text>

          {/* Status + carrier */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <View style={{ backgroundColor: sc.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10 }}>
              <Text style={{ color: sc.text, fontWeight: '700', fontSize: 12 }}>{label}</Text>
            </View>
            <Text style={{ color: '#93b4d8', fontSize: 12 }}>{shipment.carrier_name}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}>

          {/* ── Mini map ────────────────────────────────────────────────── */}
          <View style={{ marginBottom: 16 }}>
            <MiniMap shipment={shipment} events={events} />
          </View>

          {/* ── Risk gauge + stats ──────────────────────────────────────── */}
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <RiskGauge score={shipment.delay_risk_score ?? 0} />
            </View>
            {/* Stats row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -4 }}>
              <StatBox label="Weight"      value={formatWeight(shipment.weight_kg)} />
              <StatBox label="Distance"    value={`${shipment.route.distance_km.toLocaleString()} km`} />
              <StatBox label="Est. Transit" value={`${shipment.route.estimated_hours}h`} />
              {arrivalDelta && (
                <StatBox label="Arrival Delta" value={arrivalDelta} />
              )}
            </View>
          </View>

          {/* ── Schedule ────────────────────────────────────────────────── */}
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              Schedule
            </Text>
            {[
              { label: 'Scheduled Departure', value: formatDate(shipment.scheduled_departure) },
              { label: 'Scheduled Arrival',   value: formatDate(shipment.scheduled_arrival)   },
              { label: 'Actual Departure',     value: shipment.actual_departure ? formatDate(shipment.actual_departure) : '—' },
              { label: 'Actual Arrival',       value: shipment.actual_arrival   ? formatDate(shipment.actual_arrival)   : '—' },
            ].map(({ label: l, value: v }) => (
              <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>{l}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>{v}</Text>
              </View>
            ))}
          </View>

          {/* ── Tracking timeline ─────────────────────────────────────────── */}
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
              Tracking Timeline · {events.length} event{events.length !== 1 ? 's' : ''}
            </Text>

            {events.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Ionicons name="location-outline" size={32} color="#cbd5e1" />
                <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>No tracking events yet</Text>
                {canLog && (
                  <TouchableOpacity
                    onPress={() => router.push(`/shipment/log-event?id=${shipment.id}`)}
                    style={{ marginTop: 14, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: '#0f2d5e', borderRadius: 12 }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Log the first event</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              events.map((ev, idx) => (
                <TimelineEvent key={ev.id} event={ev} isLast={idx === events.length - 1} />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
