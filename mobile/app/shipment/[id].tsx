import { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Dimensions } from 'react-native'
import Constants from 'expo-constants'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { SHIPMENT_STATUS_COLORS, SHIPMENT_STATUS_LABELS, riskLevel } from '@shared/utils/statusColors'
import { formatDate, formatDateTime, formatWeight, timeAgo } from '@shared/utils/formatters'
import { StatusBadge, SectionLabel, Card, Button, GlassCard, Skeleton } from '@/components/ui'
import type { Shipment, TrackingEvent, EventType } from '@shared/api/types'

const { width: SCREEN_W } = Dimensions.get('window')
const MAPLIBRE_SUPPORTED = Constants.appOwnership !== 'expo'
const MapLibreGL = MAPLIBRE_SUPPORTED ? (require('@maplibre/maplibre-react-native').default as any) : null

const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  'Mombasa': { latitude: -4.0435, longitude: 39.6682 },
  'Nairobi': { latitude: -1.2921, longitude: 36.8219 },
  'Kampala': { latitude: 0.3476, longitude: 32.5825 },
  'Kigali': { latitude: -1.9441, longitude: 30.0619 },
  'Dar es Salaam': { latitude: -6.7924, longitude: 39.2083 },
  'Kisumu': { latitude: -0.1022, longitude: 34.7617 },
  'Eldoret': { latitude: 0.5143, longitude: 35.2698 },
  'Bujumbura': { latitude: -3.3731, longitude: 29.3644 },
  'Juba': { latitude: 4.8594, longitude: 31.5713 },
  'Dodoma': { latitude: -6.1731, longitude: 35.7395 },
}

function lookupCoords(city: string) {
  const key = Object.keys(CITY_COORDS).find((k) =>
    city.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(city.toLowerCase()))
  return key ? CITY_COORDS[key] : null
}

const EVENT_BORDER_COLOR: Record<EventType, string> = {
  DEPARTURE: '#3b82f6', CHECKPOINT: '#94a3b8', CUSTOMS_ENTRY: '#f59e0b', CUSTOMS_CLEAR: '#f59e0b',
  ARRIVAL: '#10b981', DELAY: '#ef4444', NOTE: '#94a3b8',
}
const EVENT_ICONS: Record<EventType, React.ComponentProps<typeof Ionicons>['name']> = {
  DEPARTURE: 'airplane', CHECKPOINT: 'location', CUSTOMS_ENTRY: 'document-text', CUSTOMS_CLEAR: 'checkmark-done',
  ARRIVAL: 'flag', DELAY: 'warning', NOTE: 'chatbubble-outline',
}

// ── Risk Gauge ────────────────────────────────────────────────────────────────

function RiskGauge({ score }: { score: number }) {
  const size = 140; const stroke = 12; const r = (size - stroke) / 2; const cx = size / 2; const cy = size / 2
  const pct = Math.min(Math.max(score, 0), 1)
  const color = riskLevel(score).color

  const trackD = `M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`
  const angleDeg = 180 * pct
  const angleRad = ((180 - angleDeg) * Math.PI) / 180
  const x2 = cx + r * Math.cos(angleRad)
  const y2 = cy - r * Math.sin(angleRad)
  const largeArc = angleDeg > 180 ? 1 : 0
  const arcD = pct > 0 ? `M ${stroke / 2} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}` : ''

  return (
    <View className="items-center">
      <View style={{ width: size, height: size / 2 + 10, overflow: 'hidden' }}>
        <Svg width={size} height={size}>
          <Path d={trackD} fill="none" stroke="#e5e7eb" strokeWidth={stroke} strokeLinecap="round" />
          {arcD ? <Path d={arcD} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
        </Svg>
      </View>
      <Text className="text-ct-2xl font-extrabold -mt-1.5" style={{ color }}>{Math.round(score * 100)}%</Text>
      <Text className="text-ct-xs text-ct-text-muted dark:text-ct-dark-text-muted mt-0.5">Delay Risk · {riskLevel(score).label}</Text>
    </View>
  )
}

// ── Mini Map ──────────────────────────────────────────────────────────────────

function MiniMap({ shipment, events }: { shipment: Shipment; events: TrackingEvent[] }) {
  const originCoords = lookupCoords(shipment.route.origin)
  const destCoords = lookupCoords(shipment.route.destination)
  const origin = originCoords ? [originCoords.longitude, originCoords.latitude] as [number, number] : null
  const dest = destCoords ? [destCoords.longitude, destCoords.latitude] as [number, number] : null

  let markerLL: [number, number] = origin ?? [36.8219, -1.2921]
  if (events.length > 0) {
    const latest = lookupCoords(events[0].location)
    if (latest) markerLL = [latest.longitude, latest.latitude]
    else if (origin && dest) markerLL = [(origin[0] + dest[0]) / 2, (origin[1] + dest[1]) / 2]
  } else if (origin && dest) {
    markerLL = [(origin[0] + dest[0]) / 2, (origin[1] + dest[1]) / 2]
  }

  const routeGeoJSON: GeoJSON.FeatureCollection | null = origin && dest ? {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [origin, dest] }, properties: {} }],
  } : null

  return (
    <View className="h-[180px] rounded-ct-lg overflow-hidden">
      {!MAPLIBRE_SUPPORTED || !MapLibreGL ? (
        <View className="flex-1 bg-blue-50 dark:bg-blue-900/20 items-center justify-center px-5">
          <Ionicons name="map-outline" size={36} color="#1d4ed8" />
          <Text className="text-ct-sm font-bold text-slate-900 dark:text-ct-dark-text mt-2.5">Map preview available in dev build</Text>
          <Text className="text-ct-xs text-slate-600 dark:text-slate-400 mt-1.5 text-center leading-[17px]">
            Expo Go cannot load the native MapLibre view, but shipment details and tracking events still work here.
          </Text>
        </View>
      ) : (
        <MapLibreGL.MapView
          style={{ flex: 1 }}
          mapStyle={JSON.stringify(require('@/assets/cargotrack-map-style.json'))}
          scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
          logoEnabled={false} attributionEnabled={false}
        >
          <MapLibreGL.Camera zoomLevel={6} centerCoordinate={markerLL} animationDuration={0} />
          {routeGeoJSON && (
            <MapLibreGL.ShapeSource id="route" shape={routeGeoJSON}>
              <MapLibreGL.LineLayer id="route-line" style={{ lineColor: '#2563EB', lineWidth: 2, lineOpacity: 0.55, lineDasharray: [5, 3] }} />
            </MapLibreGL.ShapeSource>
          )}
          <MapLibreGL.PointAnnotation id="current" coordinate={markerLL}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#f5801e', borderWidth: 2.5, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3 }} />
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
      )}
    </View>
  )
}

// ── Stat Box ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="flex-1 bg-slate-50 dark:bg-ct-dark-surface rounded-ct-md p-3 m-1">
      <Text className="text-[10px] text-ct-text-faint dark:text-slate-400 font-semibold uppercase tracking-[0.5px]">{label}</Text>
      <Text className="text-ct-base font-extrabold text-ct-text-primary dark:text-ct-dark-text mt-[3px]">{value}</Text>
      {sub ? <Text className="text-[10px] text-ct-text-muted dark:text-ct-dark-text-muted mt-px">{sub}</Text> : null}
    </View>
  )
}

// ── Timeline Event ────────────────────────────────────────────────────────────

function TimelineEventRow({ event, isLast }: { event: TrackingEvent; isLast: boolean }) {
  const color = EVENT_BORDER_COLOR[event.event_type as EventType] ?? '#94a3b8'
  const iconName = EVENT_ICONS[event.event_type as EventType] ?? 'ellipse'

  return (
    <View className="flex-row mb-3" style={isLast ? { marginBottom: 0 } : undefined}>
      <View className="w-8 items-center">
        <View className="w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: `${color}22` }}>
          <Ionicons name={iconName} size={13} color={color} />
        </View>
        {!isLast && <View className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 mt-0.5" style={{ minHeight: 16 }} />}
      </View>
      <View className="flex-1 ml-2.5">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className="text-ct-sm font-bold text-ct-text-primary dark:text-ct-dark-text">{event.event_type_display}</Text>
          <Text className="text-[10px] text-ct-text-faint dark:text-slate-400">{timeAgo(event.timestamp)}</Text>
        </View>
        <Text className="text-ct-xs text-ct-text-muted dark:text-ct-dark-text-muted">{event.location}</Text>
        <Text className="text-[10px] text-ct-text-faint dark:text-slate-400">{formatDateTime(event.timestamp)}</Text>
        {event.notes ? <Text className="text-ct-xs text-ct-text-muted dark:text-ct-dark-text-muted italic mt-[3px]">{event.notes}</Text> : null}
        {event.recorded_by_name ? <Text className="text-[10px] text-ct-text-faint dark:text-slate-400 mt-px">by {event.recorded_by_name}</Text> : null}
      </View>
    </View>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const CAN_LOG_EVENTS = ['ADMIN', 'LOGISTICS_MGR', 'CARRIER']

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const userRole = useAuthStore((s) => s.user?.role)
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [events, setEvents] = useState<TrackingEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const numId = Number(id)
    Promise.all([shipmentsApi.get(numId), shipmentsApi.trackingEvents(numId)])
      .then(([shRes, evRes]) => {
        setShipment(shRes.data)
        const raw = evRes.data
        const list: TrackingEvent[] = Array.isArray(raw) ? raw : (raw as any).results ?? []
        setEvents([...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
      })
      .catch(() => { Alert.alert('Error', 'Could not load shipment details.'); router.back() })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ct-dark-bg">
        <Skeleton variant="profile" className="w-4/5" />
        <View className="mt-4 w-4/5">
          <Skeleton variant="rect" className="h-[180px] rounded-ct-lg mb-3" />
          <Skeleton variant="card" />
        </View>
      </View>
    )
  }

  if (!shipment) return null

  const canLog = userRole && CAN_LOG_EVENTS.includes(userRole)

  let arrivalDelta: string | null = null
  if (shipment.actual_arrival && shipment.scheduled_arrival) {
    const diffMs = new Date(shipment.actual_arrival).getTime() - new Date(shipment.scheduled_arrival).getTime()
    const diffHours = Math.round(diffMs / 3_600_000)
    if (diffHours > 0) arrivalDelta = `+${diffHours}h late`
    else if (diffHours < 0) arrivalDelta = `${Math.abs(diffHours)}h early`
    else arrivalDelta = 'On time'
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ct-surface-bg dark:bg-ct-dark-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Glass hero header */}
        <GlassCard variant="elevated" accentColor="#f5801e" accentPosition="top" className="mx-4 mt-ct-lg mb-4">
          <View className="p-ct-lg">
            <View className="flex-row items-center justify-between mb-4">
              <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
                <Ionicons name="chevron-back" size={18} color="#94a3b8" />
                <Text className="text-ct-text-muted dark:text-slate-300 text-ct-sm ml-0.5">Back</Text>
              </TouchableOpacity>
              {canLog && (
                <TouchableOpacity
                  onPress={() => router.push(`/shipment/log-event?id=${shipment.id}`)}
                  className="flex-row items-center bg-ct-orange rounded-ct-md px-3 py-[7px]"
                >
                  <Ionicons name="add-circle-outline" size={14} color="#fff" />
                  <Text className="text-ct-xs font-bold text-white ml-[5px]">Log Event</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text className="text-ct-xl font-extrabold text-ct-text-primary dark:text-white tracking-tight">{shipment.tracking_number}</Text>
            <Text className="text-ct-text-muted dark:text-slate-300 text-ct-sm mt-[3px]">{shipment.route.origin} → {shipment.route.destination}</Text>

            <View className="flex-row items-center mt-2.5">
              <StatusBadge status={shipment.status} size="md" />
              <Text className="text-ct-text-muted dark:text-slate-300 text-ct-xs ml-2.5">{shipment.carrier_name}</Text>
            </View>
          </View>
        </GlassCard>

        <View className="px-4">
          {/* Mini map */}
          <View className="mb-4">
            <MiniMap shipment={shipment} events={events} />
          </View>

          {/* Risk gauge + stats */}
          <GlassCard variant="subtle" className="mb-4">
            <View className="p-4">
              <View className="items-center mb-4">
                <RiskGauge score={shipment.delay_risk_score ?? 0} />
              </View>
              <View className="flex-row flex-wrap -m-1">
                <StatBox label="Weight" value={formatWeight(shipment.weight_kg)} />
                <StatBox label="Distance" value={`${shipment.route.distance_km.toLocaleString()} km`} />
                <StatBox label="Est. Transit" value={`${shipment.route.estimated_hours}h`} />
                {arrivalDelta && <StatBox label="Arrival Delta" value={arrivalDelta} />}
              </View>
            </View>
          </GlassCard>

          {/* Schedule */}
          <GlassCard variant="subtle" className="mb-4">
            <SectionLabel label="Schedule" className="mb-3" />
            {[
              { label: 'Scheduled Departure', value: formatDate(shipment.scheduled_departure) },
              { label: 'Scheduled Arrival', value: formatDate(shipment.scheduled_arrival) },
              { label: 'Actual Departure', value: shipment.actual_departure ? formatDate(shipment.actual_departure) : '—' },
              { label: 'Actual Arrival', value: shipment.actual_arrival ? formatDate(shipment.actual_arrival) : '—' },
            ].map(({ label: l, value: v }) => (
              <View key={l} className="flex-row justify-between py-2 border-b border-ct-border-light dark:border-ct-dark-border">
                <Text className="text-ct-sm text-ct-text-muted dark:text-ct-dark-text-muted">{l}</Text>
                <Text className="text-ct-sm font-semibold text-ct-text-primary dark:text-ct-dark-text">{v}</Text>
              </View>
            ))}
          </GlassCard>

          {/* Tracking timeline */}
          <GlassCard variant="subtle">
            <SectionLabel label={`Tracking Timeline · ${events.length} event${events.length !== 1 ? 's' : ''}`} className="mb-3.5" />
            {events.length === 0 ? (
              <View className="items-center py-6">
                <Ionicons name="location-outline" size={32} color="#cbd5e1" />
                <Text className="text-ct-sm text-ct-text-faint dark:text-slate-400 mt-2">No tracking events yet</Text>
                {canLog && (
                  <TouchableOpacity
                    onPress={() => router.push(`/shipment/log-event?id=${shipment.id}`)}
                    className="mt-3.5 px-[18px] py-2 bg-ct-navy dark:bg-ct-orange rounded-ct-md"
                  >
                    <Text className="text-ct-sm font-bold text-white">Log the first event</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              events.map((ev, idx) => (
                <TimelineEventRow key={ev.id} event={ev} isLast={idx === events.length - 1} />
              ))
            )}
          </GlassCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
