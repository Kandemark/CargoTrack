import { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Dimensions } from 'react-native'
import Constants from 'expo-constants'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
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
  const { colors, font } = useAppTheme()
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
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size / 2 + 10, overflow: 'hidden' }}>
        <Svg width={size} height={size}>
          <Path d={trackD} fill="none" stroke="#e5e7eb" strokeWidth={stroke} strokeLinecap="round" />
          {arcD ? <Path d={arcD} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
        </Svg>
      </View>
      <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, marginTop: -6, color }}>{Math.round(score * 100)}%</Text>
      <Text style={{ fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 }}>Delay Risk · {riskLevel(score).label}</Text>
    </View>
  )
}

// ── Mini Map ──────────────────────────────────────────────────────────────────

function MiniMap({ shipment, events }: { shipment: Shipment; events: TrackingEvent[] }) {
  const { colors, font, radius, isDark } = useAppTheme()
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
    <View style={{ height: 180, borderRadius: radius.lg, overflow: 'hidden' }}>
      {!MAPLIBRE_SUPPORTED || !MapLibreGL ? (
        <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(30,58,138,0.2)' : '#eff6ff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
          <Ionicons name="map-outline" size={36} color="#1d4ed8" />
          <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: isDark ? colors.text : '#0f172a', marginTop: 10 }}>Map preview available in dev build</Text>
          <Text style={{ fontSize: font.size.xs, color: isDark ? '#94a3b8' : '#475569', marginTop: 6, textAlign: 'center', lineHeight: 17 }}>
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
  const { colors, font, radius, isDark } = useAppTheme()
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? colors.muted : '#f8fafc', borderRadius: radius.md, padding: 12, margin: 4 }}>
      <Text style={{ fontSize: 10, color: colors.textFaint, fontWeight: font.weight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: font.size.base, fontWeight: font.weight.extrabold, color: colors.text, marginTop: 3 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 1 }}>{sub}</Text> : null}
    </View>
  )
}

// ── Timeline Event ────────────────────────────────────────────────────────────

function TimelineEventRow({ event, isLast }: { event: TrackingEvent; isLast: boolean }) {
  const { colors, font, isDark } = useAppTheme()
  const color = EVENT_BORDER_COLOR[event.event_type as EventType] ?? '#94a3b8'
  const iconName = EVENT_ICONS[event.event_type as EventType] ?? 'ellipse'

  return (
    <View style={[{ flexDirection: 'row', marginBottom: 12 }, isLast ? { marginBottom: 0 } : undefined]}>
      <View style={{ width: 32, alignItems: 'center' }}>
        <View style={{ width: 28, height: 28, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', backgroundColor: `${color}22` }}>
          <Ionicons name={iconName} size={13} color={color} />
        </View>
        {!isLast && <View style={{ width: 2, flex: 1, backgroundColor: isDark ? '#334155' : '#e2e8f0', marginTop: 2, minHeight: 16 }} />}
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text }}>{event.event_type_display}</Text>
          <Text style={{ fontSize: 10, color: colors.textFaint }}>{timeAgo(event.timestamp)}</Text>
        </View>
        <Text style={{ fontSize: font.size.xs, color: colors.textMuted }}>{event.location}</Text>
        <Text style={{ fontSize: 10, color: colors.textFaint }}>{formatDateTime(event.timestamp)}</Text>
        {event.notes ? <Text style={{ fontSize: font.size.xs, color: colors.textMuted, fontStyle: 'italic', marginTop: 3 }}>{event.notes}</Text> : null}
        {event.recorded_by_name ? <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 1 }}>by {event.recorded_by_name}</Text> : null}
      </View>
    </View>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const CAN_LOG_EVENTS = ['ADMIN', 'LOGISTICS_MGR', 'CARRIER']

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const userRole = useAuthStore((s) => s.user?.role)
  const { colors, font, radius, spacing } = useAppTheme()
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Skeleton variant="profile" style={{ width: '80%' }} />
        <View style={{ marginTop: 16, width: '80%' }}>
          <Skeleton variant="rect" style={{ height: 180, borderRadius: radius.lg, marginBottom: 12 }} />
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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Glass hero header */}
        <GlassCard variant="elevated" accentColor="#f5801e" accentPosition="top" style={{ marginHorizontal: 16, marginTop: spacing.lg, marginBottom: 16 }}>
          <View style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="chevron-back" size={18} color="#94a3b8" />
                <Text style={{ color: colors.textMuted, fontSize: font.size.sm, marginLeft: 2 }}>Back</Text>
              </TouchableOpacity>
              {canLog && (
                <TouchableOpacity
                  onPress={() => router.push(`/shipment/log-event?id=${shipment.id}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5801e', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 }}
                >
                  <Ionicons name="add-circle-outline" size={14} color="#fff" />
                  <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: '#fff', marginLeft: 5 }}>Log Event</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={{ fontSize: font.size.xl, fontWeight: font.weight.extrabold, color: colors.text, letterSpacing: -0.4 }}>{shipment.tracking_number}</Text>
            <Text style={{ color: colors.textMuted, fontSize: font.size.sm, marginTop: 3 }}>{shipment.route.origin} → {shipment.route.destination}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <StatusBadge status={shipment.status} size="md" />
              <Text style={{ color: colors.textMuted, fontSize: font.size.xs, marginLeft: 10 }}>{shipment.carrier_name}</Text>
            </View>
          </View>
        </GlassCard>

        <View style={{ paddingHorizontal: 16 }}>
          {/* Mini map */}
          <View style={{ marginBottom: 16 }}>
            <MiniMap shipment={shipment} events={events} />
          </View>

          {/* Risk gauge + stats */}
          <GlassCard variant="subtle" style={{ marginBottom: 16 }}>
            <View style={{ padding: 16 }}>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <RiskGauge score={shipment.delay_risk_score ?? 0} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -4 }}>
                <StatBox label="Weight" value={formatWeight(shipment.weight_kg)} />
                <StatBox label="Distance" value={`${shipment.route.distance_km.toLocaleString()} km`} />
                <StatBox label="Est. Transit" value={`${shipment.route.estimated_hours}h`} />
                {arrivalDelta && <StatBox label="Arrival Delta" value={arrivalDelta} />}
              </View>
            </View>
          </GlassCard>

          {/* Schedule */}
          <GlassCard variant="subtle" style={{ marginBottom: 16 }}>
            <SectionLabel label="Schedule" style={{ marginBottom: 12 }} />
            {[
              { label: 'Scheduled Departure', value: formatDate(shipment.scheduled_departure) },
              { label: 'Scheduled Arrival', value: formatDate(shipment.scheduled_arrival) },
              { label: 'Actual Departure', value: shipment.actual_departure ? formatDate(shipment.actual_departure) : '—' },
              { label: 'Actual Arrival', value: shipment.actual_arrival ? formatDate(shipment.actual_arrival) : '—' },
            ].map(({ label: l, value: v }) => (
              <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: font.size.sm, color: colors.textMuted }}>{l}</Text>
                <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.text }}>{v}</Text>
              </View>
            ))}
          </GlassCard>

          {/* Tracking timeline */}
          <GlassCard variant="subtle">
            <SectionLabel label={`Tracking Timeline · ${events.length} event${events.length !== 1 ? 's' : ''}`} style={{ marginBottom: 14 }} />
            {events.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Ionicons name="location-outline" size={32} color="#cbd5e1" />
                <Text style={{ fontSize: font.size.sm, color: colors.textFaint, marginTop: 8 }}>No tracking events yet</Text>
                {canLog && (
                  <TouchableOpacity
                    onPress={() => router.push(`/shipment/log-event?id=${shipment.id}`)}
                    style={{ marginTop: 14, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#0f2d5e', borderRadius: radius.md }}
                  >
                    <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: '#fff' }}>Log the first event</Text>
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
