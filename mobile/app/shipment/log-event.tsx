import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import type { Shipment } from '@shared/api/types'

// ─── Event types ──────────────────────────────────────────────────────────────

type EventTypeCode =
  | 'DEPARTURE'
  | 'CHECKPOINT'
  | 'CUSTOMS_ENTRY'
  | 'CUSTOMS_CLEAR'
  | 'ARRIVAL'
  | 'DELAY'
  | 'NOTE'

const EVENT_TYPES: {
  value: EventTypeCode
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
}[] = [
  { value: 'DEPARTURE',     label: 'Departure',     icon: 'airplane' },
  { value: 'CHECKPOINT',    label: 'Checkpoint',    icon: 'location' },
  { value: 'CUSTOMS_ENTRY', label: 'Customs Entry', icon: 'document-text' },
  { value: 'CUSTOMS_CLEAR', label: 'Customs Clear', icon: 'checkmark-done' },
  { value: 'ARRIVAL',       label: 'Arrival',       icon: 'flag' },
  { value: 'DELAY',         label: 'Delay',         icon: 'warning' },
  { value: 'NOTE',          label: 'Note',          icon: 'chatbubble-outline' },
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogEventScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>()
  const shipmentId = Number(id)

  const [shipment, setShipment]     = useState<Shipment | null>(null)
  const [eventType, setEventType]   = useState<EventTypeCode | null>(null)
  const [location, setLocation]     = useState('')
  const [notes, setNotes]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors]         = useState<{ eventType?: string; location?: string }>({})

  useEffect(() => {
    if (!shipmentId) return
    shipmentsApi.get(shipmentId)
      .then((r) => setShipment(r.data))
      .catch(() => {})
  }, [shipmentId])

  async function handleSubmit() {
    const errs: typeof errors = {}
    if (!eventType)       errs.eventType = 'Select an event type.'
    if (!location.trim()) errs.location  = 'Location is required.'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSubmitting(true)
    try {
      await shipmentsApi.logEvent(shipmentId, {
        event_type: eventType!,
        location:   location.trim(),
        notes:      notes.trim(),
      })
      router.replace(`/shipment/${shipmentId}`)
    } catch {
      Alert.alert('Error', 'Could not submit the event. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View className="bg-ct-navy px-5 pt-3 pb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-1 mb-4 self-start"
        >
          <Ionicons name="chevron-back" size={18} color="#93b4d8" />
          <Text className="text-blue-300 text-sm">Back</Text>
        </TouchableOpacity>

        <Text className="text-white text-xl font-bold">Log Tracking Event</Text>
        {shipment ? (
          <View className="flex-row items-center gap-2 mt-1.5">
            <Text className="text-blue-300 text-xs font-mono font-semibold">
              {shipment.tracking_number}
            </Text>
            <Text className="text-blue-400 text-xs">·</Text>
            <Text className="text-blue-300 text-xs flex-1" numberOfLines={1}>
              {shipment.route.origin} → {shipment.route.destination}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          className="mx-4 mt-4 bg-white rounded-2xl overflow-hidden"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowOffset: { width: 0, height: 1 },
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          {/* ── Event type ─────────────────────────────────────────────────── */}
          <View className="px-4 pt-5 pb-4 border-b border-gray-100">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Event Type <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {EVENT_TYPES.map((opt) => {
                const sel = eventType === opt.value
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => { setEventType(opt.value); setErrors((e) => ({ ...e, eventType: undefined })) }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: sel ? '#0f2d5e' : '#e5e7eb',
                      backgroundColor: sel ? '#0f2d5e' : '#fff',
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={opt.icon} size={13} color={sel ? '#fff' : '#6b7280'} />
                    <Text
                      style={{ fontSize: 12, fontWeight: '600', color: sel ? '#fff' : '#374151' }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {errors.eventType ? (
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{errors.eventType}</Text>
            ) : null}
          </View>

          {/* ── Location ───────────────────────────────────────────────────── */}
          <View className="px-4 py-4 border-b border-gray-100">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Location <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <TextInput
              value={location}
              onChangeText={(v) => { setLocation(v); setErrors((e) => ({ ...e, location: undefined })) }}
              placeholder="e.g. Mombasa Port Gate 3"
              placeholderTextColor="#9ca3af"
              style={{
                borderWidth: 1,
                borderColor: errors.location ? '#fca5a5' : '#e5e7eb',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: '#111827',
                backgroundColor: errors.location ? '#fef2f2' : '#f9fafb',
              }}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {errors.location ? (
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.location}</Text>
            ) : null}
          </View>

          {/* ── Notes ─────────────────────────────────────────────────────── */}
          <View className="px-4 py-4">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Notes{' '}
              <Text style={{ color: '#9ca3af', fontWeight: '400', textTransform: 'none' }}>
                (optional)
              </Text>
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional context about this event…"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              style={{
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: '#111827',
                backgroundColor: '#f9fafb',
                textAlignVertical: 'top',
                minHeight: 80,
              }}
            />
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className="mx-4 mt-4 rounded-2xl py-4 items-center bg-ct-navy"
          style={{ opacity: submitting ? 0.65 : 1 }}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text className="text-white font-bold text-base">Submit Event</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
