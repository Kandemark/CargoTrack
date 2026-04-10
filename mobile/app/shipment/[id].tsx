/**
 * @file mobile/app/shipment/[id].tsx
 * @description Shipment detail screen — shows full cargo info, tracking event
 * timeline, and delay risk score for a specific shipment.
 *
 * Data flow:
 *   - Reads `id` from URL params via `useLocalSearchParams()`.
 *   - Fetches `GET /api/v1/shipments/<id>/` and
 *     `GET /api/v1/shipments/<id>/tracking-events/` in parallel on mount.
 *   - "Run Prediction" button calls `POST /api/v1/shipments/<id>/predict/`
 *     and updates the risk score display in-place.
 *   - "Log Event" button navigates to `shipment/log-event` with the
 *     shipment id and tracking number passed as query params.
 *
 * Platform notes:
 *   - `Alert.alert()` is used for the native confirmation dialog (iOS uses a
 *     modal sheet; Android uses a bottom dialog).
 *
 * @route /shipment/[id]
 * @auth IsAuthenticated
 */
import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import {
  SHIPMENT_STATUS_COLORS,
  SHIPMENT_STATUS_LABELS,
  riskLevel,
} from '@shared/utils/statusColors'
import { formatDate } from '@shared/utils/formatters'
import type { Shipment, TrackingEvent, ShipmentStatus, EventType } from '@shared/api/types'

// ─── Event icons ──────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<EventType, React.ComponentProps<typeof Ionicons>['name']> = {
  DEPARTURE:     'airplane',
  CHECKPOINT:    'location',
  CUSTOMS_ENTRY: 'document-text',
  CUSTOMS_CLEAR: 'checkmark-done',
  ARRIVAL:       'flag',
  DELAY:         'warning',
  NOTE:          'chatbubble-outline',
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-row justify-between items-start py-2.5 border-b border-gray-100">
      <Text className="text-gray-400 text-sm w-36">{label}</Text>
      <Text className="text-gray-900 text-sm font-medium flex-1 text-right" numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}

// ─── Timeline event ───────────────────────────────────────────────────────────

function TimelineEvent({ event, isLast }: { event: TrackingEvent; isLast: boolean }) {
  const iconName = EVENT_ICONS[event.event_type] ?? 'ellipse'
  const isDelay  = event.event_type === 'DELAY'
  const date     = new Date(event.timestamp).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <View className="flex-row">
      {/* Timeline spine */}
      <View className="w-10 items-center">
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: isDelay ? '#fef2f2' : '#eff6ff' }}
        >
          <Ionicons name={iconName} size={15} color={isDelay ? '#dc2626' : '#0f2d5e'} />
        </View>
        {!isLast && (
          <View className="w-0.5 flex-1 bg-gray-200 mt-1" style={{ minHeight: 20 }} />
        )}
      </View>

      {/* Content */}
      <View className="flex-1 ml-3 pb-5">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className="text-gray-900 text-sm font-semibold">{event.event_type_display}</Text>
          <Text className="text-gray-400 text-xs">{date}</Text>
        </View>
        <Text className="text-gray-600 text-sm">{event.location}</Text>
        {event.notes ? (
          <Text className="text-gray-400 text-xs mt-1 italic">{event.notes}</Text>
        ) : null}
        {event.recorded_by_name ? (
          <Text className="text-gray-400 text-xs mt-0.5">by {event.recorded_by_name}</Text>
        ) : null}
      </View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

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
        setEvents(Array.isArray(raw) ? raw : (raw as any).results ?? [])
      })
      .catch(() => {
        Alert.alert('Error', 'Could not load shipment details.')
        router.back()
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#f5801e" />
      </View>
    )
  }

  if (!shipment) return null

  const sc       = SHIPMENT_STATUS_COLORS[shipment.status as ShipmentStatus] ?? SHIPMENT_STATUS_COLORS.PENDING
  const label    = SHIPMENT_STATUS_LABELS[shipment.status as ShipmentStatus] ?? shipment.status
  const riskPct  = Math.round((shipment.delay_risk_score ?? 0) * 100)
  const risk     = riskLevel(shipment.delay_risk_score ?? 0)
  const canLog   = userRole && CAN_LOG_EVENTS.includes(userRole)

  const fmtDate = (d: string | null) => d ? formatDate(d) : '—'

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View className="bg-ct-navy px-5 pt-3 pb-8">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-1 mb-4 self-start"
        >
          <Ionicons name="chevron-back" size={18} color="#93b4d8" />
          <Text className="text-blue-300 text-sm">Back</Text>
        </TouchableOpacity>

        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-white text-xl font-bold font-mono">
              {shipment.tracking_number}
            </Text>
            <Text className="text-blue-300 text-sm mt-1">
              {shipment.route.origin} → {shipment.route.destination}
            </Text>
          </View>
          {/* Log Event button — CARRIER role only */}
          {canLog && (
            <TouchableOpacity
              onPress={() => router.push(`/shipment/log-event?id=${shipment.id}`)}
              style={{
                backgroundColor: '#f5801e',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 7,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Ionicons name="add-circle-outline" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Log Event</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status + risk */}
        <View className="flex-row items-center gap-3 mt-4">
          <View
            style={{
              backgroundColor: sc.background,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: sc.text, fontWeight: '700', fontSize: 12 }}>{label}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-blue-300 text-xs">Delay Risk</Text>
              <Text className="text-xs font-bold" style={{ color: risk.color }}>
                {riskPct}% · {risk.label}
              </Text>
            </View>
            {/* Progress bar */}
            <View
              style={{
                height: 5,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: 5,
                  width: `${riskPct}%` as any,
                  backgroundColor: risk.color,
                  borderRadius: 3,
                }}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Details card */}
      <View
        className="bg-white mx-4 -mt-4 rounded-2xl px-4 py-2 mb-4"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <InfoRow label="Carrier"             value={shipment.carrier_name} />
        <InfoRow label="Weight"              value={`${shipment.weight_kg.toLocaleString()} kg`} />
        <InfoRow label="Scheduled Dep."      value={fmtDate(shipment.scheduled_departure)} />
        <InfoRow label="Scheduled Arr."      value={fmtDate(shipment.scheduled_arrival)} />
        <InfoRow label="Actual Dep."         value={fmtDate(shipment.actual_departure)} />
        <InfoRow label="Actual Arr."         value={fmtDate(shipment.actual_arrival)} />
        <InfoRow label="Distance"            value={`${shipment.route.distance_km.toLocaleString()} km`} />
      </View>

      {/* Timeline */}
      <View
        className="bg-white mx-4 mb-8 rounded-2xl px-4 py-4"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <Text className="text-gray-900 text-sm font-bold mb-4">
          Tracking Timeline · {events.length} events
        </Text>

        {events.length === 0 ? (
          <View className="items-center py-6">
            <Ionicons name="location-outline" size={32} color="#cbd5e1" />
            <Text className="text-gray-400 text-sm mt-2">No tracking events yet</Text>
            {canLog && (
              <TouchableOpacity
                onPress={() => router.push(`/shipment/log-event?id=${shipment.id}`)}
                className="mt-4 px-4 py-2 rounded-xl bg-ct-navy active:opacity-80"
              >
                <Text className="text-white text-sm font-semibold">Log the first event</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          events.map((ev, idx) => (
            <TimelineEvent key={ev.id} event={ev} isLast={idx === events.length - 1} />
          ))
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  )
}
