import { useEffect, useState, type ComponentProps } from 'react'
import { Alert, View } from 'react-native'
import Constants from 'expo-constants'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import { mapStyleFor } from '@/lib/mapStyle'
import { carrierLabel } from '@/lib/carrier'
import { formatDate, formatDateTime, formatWeight, timeAgo } from '@shared/utils/formatters'
import { Button, HeroStats, ScreenFrame, Section, Skeleton, Txt } from '@/components/ui'
import type { Shipment, TrackingEvent, EventType } from '@shared/api/types'

const MAPLIBRE_SUPPORTED = Constants.appOwnership !== 'expo'
const MapLibreGL = MAPLIBRE_SUPPORTED ? (require('@maplibre/maplibre-react-native').default as any) : null

const CITY_COORDS: Record<string, [number, number]> = {
  'Mombasa': [39.6682, -4.0435],
  'Nairobi': [36.8219, -1.2921],
  'Kampala': [32.5825, 0.3476],
  'Kigali': [30.0619, -1.9441],
  'Dar es Salaam': [39.2083, -6.7924],
  'Kisumu': [34.7617, -0.1022],
  'Eldoret': [35.2698, 0.5143],
  'Bujumbura': [29.3644, -3.3731],
  'Juba': [31.5713, 4.8594],
  'Dodoma': [35.7395, -6.1731],
  'Malaba': [34.2756, 0.6366],
  'Namanga': [36.7833, -2.55],
  'Voi': [38.5561, -3.3961],
  'Mariakani': [39.4739, -3.8625],
}

function lookupCoords(place: string): [number, number] | null {
  const key = Object.keys(CITY_COORDS).find((k) => place.toLowerCase().includes(k.toLowerCase()))
  return key ? CITY_COORDS[key] : null
}

const EVENT_ICON: Record<EventType, ComponentProps<typeof Ionicons>['name']> = {
  DEPARTURE: 'navigate-outline',
  CHECKPOINT: 'flag-outline',
  CUSTOMS_ENTRY: 'document-text-outline',
  CUSTOMS_CLEAR: 'checkmark-done-outline',
  ARRIVAL: 'checkmark-circle-outline',
  DELAY: 'time-outline',
  NOTE: 'chatbox-outline',
}

const CAN_LOG_EVENTS = ['ADMIN', 'LOGISTICS_MGR', 'CARRIER']

/**
 * One shipment. The header names the route and the three numbers that
 * matter; the journey card shows where it is between the two ends and
 * the dates; then the map, who is moving it, and its tracking history.
 */
export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const { risk } = useAppTheme()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [events, setEvents] = useState<TrackingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(isRefresh = false) {
    if (!id) return
    if (isRefresh) setRefreshing(true)
    const numId = Number(id)
    try {
      const [shRes, evRes] = await Promise.all([shipmentsApi.get(numId), shipmentsApi.trackingEvents(numId)])
      setShipment(shRes.data)
      const raw = evRes.data
      const list: TrackingEvent[] = Array.isArray(raw) ? raw : (raw as any).results ?? []
      setEvents([...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
    } catch {
      Alert.alert('Could not load shipment', 'Check your connection and try again.')
      if (!isRefresh) router.back()
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading || !shipment) {
    return (
      <ScreenFrame title="Shipment" onBack={() => router.back()}>
        <View style={{ gap: 16 }}>
          <Skeleton variant="card" style={{ height: 140 }} />
          <Skeleton variant="card" style={{ height: 200 }} />
        </View>
      </ScreenFrame>
    )
  }

  const score = shipment.delay_risk_score ?? 0
  const delivered = shipment.status === 'DELIVERED'
  const canLog = !!user?.role && CAN_LOG_EVENTS.includes(user.role)
  const logEvent = () => router.push(`/shipment/log-event?id=${shipment.id}` as any)

  return (
    <ScreenFrame
      onBack={() => router.back()}
      eyebrow={shipment.tracking_number}
      title={`${shipment.route.origin} → ${shipment.route.destination}`}
      subtitle={shipment.status_display}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      hero={
        <HeroStats
          items={[
            delivered
              ? { label: 'Arrived', value: shortDate(shipment.actual_arrival ?? shipment.scheduled_arrival) }
              : { label: 'Due', value: shortDate(shipment.scheduled_arrival) },
            delivered
              ? { label: 'Arrival', value: arrivalDelta(shipment) ?? '—' }
              : {
                  label: 'Delay risk',
                  value: `${Math.round(score * 100)}%`,
                  tone: score >= 0.7 ? 'danger' : score >= 0.4 ? 'warning' : undefined,
                },
            { label: 'Distance', value: `${shipment.route.distance_km.toLocaleString()} km` },
          ]}
        />
      }>
      <JourneyCard shipment={shipment} lastPlace={events[0]?.location} />

      {MAPLIBRE_SUPPORTED && MapLibreGL ? <MiniMap shipment={shipment} events={events} /> : null}

      <Section label="Details">
        <KeyValue label="Carrier" value={carrierLabel(shipment.carrier_name, user?.org_name)} />
        <KeyValue label="Driver" value={shipment.driver_name || 'Not assigned'} />
        <KeyValue label="Dispatch" value={shipment.dispatch_status_display || '—'} />
        <KeyValue label="Weight" value={formatWeight(shipment.weight_kg)} />
        <KeyValue label="Planned transit" value={`${shipment.route.estimated_hours} hours`} last />
      </Section>

      <Section label="Tracking" action={canLog && events.length > 0 ? 'Log event' : undefined} onAction={logEvent}>
        {events.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
            <Ionicons name="location-outline" size={32} color={risk.low} style={{ opacity: 0.6 }} />
            <Txt variant="body" tone="muted">No updates yet</Txt>
            {canLog ? (
              <Button variant="primary" onPress={logEvent} style={{ marginTop: 8 }}>
                Log the first update
              </Button>
            ) : null}
          </View>
        ) : (
          events.map((ev, i) => <TimelineRow key={ev.id} event={ev} first={i === 0} last={i === events.length - 1} />)
        )}
      </Section>
    </ScreenFrame>
  )
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function arrivalDelta(s: Shipment): string | null {
  if (!s.actual_arrival) return null
  const hours = Math.round((new Date(s.actual_arrival).getTime() - new Date(s.scheduled_arrival).getTime()) / 3_600_000)
  if (hours > 0) return `${hours}h late`
  if (hours < 0) return `${-hours}h early`
  return 'On time'
}

/** How far along the trip is, from departure to planned arrival. */
function progressOf(s: Shipment): number {
  if (s.status === 'DELIVERED') return 1
  if (!s.actual_departure) return 0
  const start = new Date(s.actual_departure).getTime()
  const end = new Date(s.scheduled_arrival).getTime()
  if (end <= start) return 0.95
  return Math.min(Math.max((Date.now() - start) / (end - start), 0.04), 0.95)
}

/**
 * The trip at a glance: both ends, a line with the truck's position on
 * it, and the planned and actual dates under each end.
 */
function JourneyCard({ shipment, lastPlace }: { shipment: Shipment; lastPlace?: string }) {
  const { colors, brand, isDark, ui } = useAppTheme()
  const progress = progressOf(shipment)
  const delayed = shipment.status === 'DELAYED'
  const fill = delayed ? ui.danger : brand.accent
  const where =
    shipment.status === 'DELIVERED'
      ? 'Delivered'
      : !shipment.actual_departure
        ? 'Waiting to depart'
        : lastPlace
          ? `Last seen at ${lastPlace}`
          : 'On the road'

  return (
    <View style={{ backgroundColor: isDark ? colors.muted : '#F4F6FA', borderRadius: 20, padding: 20 }}>
      <Txt variant="caption" tone="muted">{where}</Txt>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: fill }} />
        <View style={{ flex: 1, height: 4, marginHorizontal: 6, borderRadius: 2, backgroundColor: colors.border }}>
          <View style={{ width: `${progress * 100}%`, height: 4, borderRadius: 2, backgroundColor: fill }} />
          {progress > 0 && progress < 1 ? (
            <View
              style={{
                position: 'absolute',
                left: `${progress * 100}%`,
                top: -12,
                marginLeft: -14,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: fill,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 3,
                borderColor: isDark ? colors.muted : '#F4F6FA',
              }}>
              <Ionicons name="car-outline" size={13} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: progress >= 1 ? fill : 'transparent',
            borderWidth: 2,
            borderColor: progress >= 1 ? fill : colors.textFaint,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', marginTop: 18, gap: 16 }}>
        <End
          place={shipment.route.origin}
          planned={shipment.scheduled_departure}
          actual={shipment.actual_departure}
          actualLabel="Left"
        />
        <End
          place={shipment.route.destination}
          planned={shipment.scheduled_arrival}
          actual={shipment.actual_arrival}
          actualLabel="Arrived"
          alignEnd
        />
      </View>
    </View>
  )
}

function End({
  place,
  planned,
  actual,
  actualLabel,
  alignEnd = false,
}: {
  place: string
  planned: string
  actual: string | null
  actualLabel: string
  alignEnd?: boolean
}) {
  const align = alignEnd ? 'right' : 'left'
  return (
    <View style={{ flex: 1, alignItems: alignEnd ? 'flex-end' : 'flex-start' }}>
      <Txt variant="heading" numberOfLines={1} style={{ textAlign: align }}>{place}</Txt>
      <Txt variant="caption" tone="muted" style={{ marginTop: 4, textAlign: align }}>
        {actual ? `${actualLabel} ${formatDate(actual)}` : `Planned ${formatDate(planned)}`}
      </Txt>
      {actual ? (
        <Txt variant="caption" tone="faint" style={{ textAlign: align }}>Planned {formatDate(planned)}</Txt>
      ) : null}
    </View>
  )
}

function KeyValue({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors } = useAppTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 16,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: colors.borderMid,
      }}>
      <Txt variant="body" tone="muted" style={{ flex: 1 }}>{label}</Txt>
      <Txt variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Txt>
    </View>
  )
}

/** One tracking update; a line joins it to the one before. Newest first. */
function TimelineRow({ event, first, last }: { event: TrackingEvent; first: boolean; last: boolean }) {
  const { colors, brand, isDark, ui } = useAppTheme()
  const isDelay = event.event_type === 'DELAY'
  const tint = isDelay ? ui.danger : first ? brand.accent : isDark ? colors.textBrand : brand.primary
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center', width: 36 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${tint}1A`,
          }}>
          <Ionicons name={EVENT_ICON[event.event_type] ?? 'ellipse-outline'} size={18} color={tint} />
        </View>
        {!last ? <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 22, paddingTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt variant="bodyStrong" style={{ flex: 1 }}>{event.event_type_display}</Txt>
          <Txt variant="caption" tone="faint">{timeAgo(event.timestamp)}</Txt>
        </View>
        <Txt variant="body" tone="secondary" style={{ marginTop: 2 }}>{event.location}</Txt>
        {event.notes ? (
          <Txt variant="caption" tone="muted" style={{ marginTop: 6 }}>{event.notes}</Txt>
        ) : null}
        <Txt variant="caption" tone="faint" style={{ marginTop: 6 }}>
          {formatDateTime(event.timestamp)}
          {event.recorded_by_name ? ` · ${event.recorded_by_name}` : ''}
        </Txt>
      </View>
    </View>
  )
}

/** The route on a real map: both ends, the line between, and the last known place. */
function MiniMap({ shipment, events }: { shipment: Shipment; events: TrackingEvent[] }) {
  const { isDark, brand, ui } = useAppTheme()
  const origin = lookupCoords(shipment.route.origin)
  const dest = lookupCoords(shipment.route.destination)
  if (!origin || !dest) return null

  const last = events[0] ? lookupCoords(events[0].location) : null
  const here = shipment.status === 'DELIVERED' ? dest : last ?? (shipment.actual_departure ? null : origin)
  const route: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [origin, dest] }, properties: {} }],
  }
  const pad = 48
  const bounds = {
    ne: [Math.max(origin[0], dest[0]), Math.max(origin[1], dest[1])],
    sw: [Math.min(origin[0], dest[0]), Math.min(origin[1], dest[1])],
    paddingTop: pad, paddingBottom: pad, paddingLeft: pad, paddingRight: pad,
  }
  const dot = (color: string, size: number) => (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 2.5, borderColor: '#FFFFFF' }} />
  )

  return (
    <View style={{ height: 200, borderRadius: 20, overflow: 'hidden' }}>
      <MapLibreGL.MapView
        style={{ flex: 1 }}
        mapStyle={mapStyleFor(isDark)}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        logoEnabled={false}
        attributionEnabled
        attributionPosition={{ bottom: 8, right: 8 }}>
        <MapLibreGL.Camera bounds={bounds} animationDuration={0} />
        <MapLibreGL.ShapeSource id="route" shape={route}>
          <MapLibreGL.LineLayer
            id="route-line"
            style={{ lineColor: isDark ? '#93C5FD' : brand.primary, lineWidth: 3, lineOpacity: 0.7, lineDasharray: [2, 1.5] }}
          />
        </MapLibreGL.ShapeSource>
        <MapLibreGL.PointAnnotation id="origin" coordinate={origin}>{dot(isDark ? '#93C5FD' : brand.primary, 14)}</MapLibreGL.PointAnnotation>
        <MapLibreGL.PointAnnotation id="dest" coordinate={dest}>{dot('#16A34A', 14)}</MapLibreGL.PointAnnotation>
        {here ? (
          <MapLibreGL.PointAnnotation id="here" coordinate={here}>
            {dot(shipment.status === 'DELAYED' ? ui.danger : brand.accent, 18)}
          </MapLibreGL.PointAnnotation>
        ) : null}
      </MapLibreGL.MapView>
    </View>
  )
}
