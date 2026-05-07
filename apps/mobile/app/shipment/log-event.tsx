import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { Button } from '@/components/ui'
import type { Shipment } from '@shared/api/types'

type EventTypeCode = 'DEPARTURE' | 'CHECKPOINT' | 'CUSTOMS_ENTRY' | 'CUSTOMS_CLEAR' | 'ARRIVAL' | 'DELAY' | 'NOTE'

const EVENT_TYPES: { value: EventTypeCode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'DEPARTURE', label: 'Departure', icon: 'airplane' },
  { value: 'CHECKPOINT', label: 'Checkpoint', icon: 'location' },
  { value: 'CUSTOMS_ENTRY', label: 'Customs Entry', icon: 'document-text' },
  { value: 'CUSTOMS_CLEAR', label: 'Customs Clear', icon: 'checkmark-done' },
  { value: 'ARRIVAL', label: 'Arrival', icon: 'flag' },
  { value: 'DELAY', label: 'Delay', icon: 'warning' },
  { value: 'NOTE', label: 'Note', icon: 'chatbubble-outline' },
]

export default function LogEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const shipmentId = Number(id)

  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [eventType, setEventType] = useState<EventTypeCode | null>(null)
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ eventType?: string; location?: string }>({})

  useEffect(() => {
    if (!shipmentId) return
    shipmentsApi.get(shipmentId).then((r) => setShipment(r.data)).catch(() => {})
  }, [shipmentId])

  async function handleSubmit() {
    const errs: typeof errors = {}
    if (!eventType) errs.eventType = 'Select an event type.'
    if (!location.trim()) errs.location = 'Location is required.'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitting(true)
    try {
      await shipmentsApi.logEvent(shipmentId, { event_type: eventType!, location: location.trim(), notes: notes.trim() })
      router.replace(`/shipment/${shipmentId}`)
    } catch {
      Alert.alert('Error', 'Could not submit the event. Please try again.')
    } finally { setSubmitting(false) }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ct-navy">
      <KeyboardAvoidingView className="flex-1 bg-gray-50 dark:bg-ct-dark-bg" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View className="bg-ct-navy dark:bg-ct-dark-bg px-5 pt-3 pb-6">
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-4 self-start">
            <Ionicons name="chevron-back" size={18} color="#93b4d8" />
            <Text className="text-blue-300 text-ct-sm ml-0.5">Back</Text>
          </TouchableOpacity>

          <Text className="text-ct-xl font-bold text-white">Log Tracking Event</Text>
          {shipment ? (
            <View className="flex-row items-center mt-1.5">
              <Text className="text-blue-300 text-ct-xs font-bold tabular-nums">{shipment.tracking_number}</Text>
              <Text className="text-blue-400 text-ct-xs mx-1">·</Text>
              <Text className="text-blue-300 text-ct-xs flex-1" numberOfLines={1}>{shipment.route.origin} → {shipment.route.destination}</Text>
            </View>
          ) : null}
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="mx-4 mt-4 bg-ct-surface-card dark:bg-ct-dark-card rounded-ct-2xl shadow-sm overflow-hidden">
            {/* Event type */}
            <View className="px-4 pt-5 pb-4 border-b border-ct-border-light dark:border-ct-dark-border">
              <Text className="text-ct-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                Event Type <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {EVENT_TYPES.map((opt) => {
                  const sel = eventType === opt.value
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => { setEventType(opt.value); setErrors((e) => ({ ...e, eventType: undefined })) }}
                      className={`flex-row items-center px-3 py-[7px] rounded-ct-md border-[1.5px] ${sel ? 'border-ct-navy dark:border-ct-orange bg-ct-navy dark:bg-ct-orange' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-ct-dark-surface'}`}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={opt.icon} size={13} color={sel ? '#fff' : '#6b7280'} style={{ marginRight: 5 }} />
                      <Text className={`text-ct-xs font-semibold ${sel ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>{opt.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {errors.eventType ? <Text className="text-ct-xs text-ct-danger mt-1.5">{errors.eventType}</Text> : null}
            </View>

            {/* Location */}
            <View className="px-4 py-4 border-b border-ct-border-light dark:border-ct-dark-border">
              <Text className="text-ct-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Location <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                value={location}
                onChangeText={(v) => { setLocation(v); setErrors((e) => ({ ...e, location: undefined })) }}
                placeholder="e.g. Mombasa Port Gate 3"
                placeholderTextColor="#9ca3af"
                className={`border rounded-ct-md px-3 py-2.5 text-ct-sm text-ct-text-primary dark:text-ct-dark-text ${errors.location ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-ct-dark-surface'}`}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {errors.location ? <Text className="text-ct-xs text-ct-danger mt-1">{errors.location}</Text> : null}
            </View>

            {/* Notes */}
            <View className="px-4 py-4">
              <Text className="text-ct-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Notes{' '}
                <Text className="text-slate-400 dark:text-slate-500 font-normal normal-case">(optional)</Text>
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional context about this event…"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                className="border border-slate-200 dark:border-slate-700 rounded-ct-md px-3 py-2.5 text-ct-sm text-ct-text-primary dark:text-ct-dark-text bg-slate-50 dark:bg-ct-dark-surface"
                style={{ textAlignVertical: 'top', minHeight: 80 }}
              />
            </View>
          </View>

          {/* Submit */}
          <View className="mx-4 mt-4">
            <Button variant="primary" size="lg" loading={submitting} onPress={handleSubmit} icon="checkmark-circle-outline">
              Submit Event
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
