import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import type { Shipment, TrackingEvent, ShipmentStatus, EventType } from '@shared/api/types'

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; bg: string; text: string }> = {
  IN_TRANSIT: { label: 'In Transit',  bg: '#f0fdf4', text: '#15803d' },
  DELAYED:    { label: 'Delayed',     bg: '#fef2f2', text: '#dc2626' },
  CUSTOMS:    { label: 'At Customs',  bg: '#fffbeb', text: '#d97706' },
  DELIVERED:  { label: 'Delivered',   bg: '#eef2ff', text: '#4f46e5' },
  PENDING:    { label: 'Pending',     bg: '#f8fafc', text: '#64748b' },
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

// ─── Detail row ───────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-row justify-between items-start py-2.5 border-b border-gray-100">
      <Text className="text-gray-500 text-sm w-36">{label}</Text>
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
  const date = new Date(event.timestamp).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <View className="flex-row">
      {/* Timeline column */}
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

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

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

  const statusCfg = STATUS_CONFIG[shipment.status] ?? STATUS_CONFIG.PENDING
  const risk      = shipment.delay_risk_score ?? 0
  const riskColor = risk >= 70 ? '#ef4444' : risk >= 40 ? '#f59e0b' : '#22c55e'

  const fmtDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—'

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      {/* Hero card */}
      <View className="bg-ct-navy px-5 pt-5 pb-8">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-1 mb-4 self-start"
        >
          <Ionicons name="chevron-back" size={18} color="#93b4d8" />
          <Text className="text-blue-300 text-sm">Back</Text>
        </TouchableOpacity>

        <Text className="text-white text-xl font-bold">{shipment.tracking_number}</Text>
        <Text className="text-blue-300 text-sm mt-1">
          {shipment.route.origin} → {shipment.route.destination}
        </Text>

        <View className="flex-row items-center gap-3 mt-4">
          <View
            style={{ backgroundColor: statusCfg.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
          >
            <Text style={{ color: statusCfg.text, fontWeight: '700', fontSize: 12 }}>
              {statusCfg.label}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-blue-300 text-xs">Risk</Text>
            <Text className="text-xs font-bold" style={{ color: riskColor }}>{risk}%</Text>
          </View>
        </View>
      </View>

      {/* Details card */}
      <View className="bg-white mx-4 -mt-4 rounded-2xl px-4 py-2 mb-4"
        style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3 }}
      >
        <InfoRow label="Carrier"              value={shipment.carrier_name} />
        <InfoRow label="Weight"               value={`${shipment.weight_kg.toLocaleString()} kg`} />
        <InfoRow label="Scheduled Departure"  value={fmtDate(shipment.scheduled_departure)} />
        <InfoRow label="Scheduled Arrival"    value={fmtDate(shipment.scheduled_arrival)} />
        <InfoRow label="Actual Departure"     value={fmtDate(shipment.actual_departure)} />
        <InfoRow label="Actual Arrival"       value={fmtDate(shipment.actual_arrival)} />
        <InfoRow label="Distance"             value={`${shipment.route.distance_km.toLocaleString()} km`} />
      </View>

      {/* Timeline */}
      <View className="bg-white mx-4 mb-8 rounded-2xl px-4 py-4"
        style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3 }}
      >
        <Text className="text-gray-900 text-sm font-bold mb-4">Tracking Timeline</Text>

        {events.length === 0 ? (
          <View className="items-center py-6">
            <Ionicons name="location-outline" size={32} color="#cbd5e1" />
            <Text className="text-gray-400 text-sm mt-2">No tracking events yet</Text>
          </View>
        ) : (
          events.map((ev, idx) => (
            <TimelineEvent key={ev.id} event={ev} isLast={idx === events.length - 1} />
          ))
        )}
      </View>
    </ScrollView>
  )
}
