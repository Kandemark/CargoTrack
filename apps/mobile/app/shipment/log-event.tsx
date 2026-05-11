import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { shipmentsApi } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
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
  const { colors, font, radius, isDark } = useAppTheme()

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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#f9fafb' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={{ backgroundColor: isDark ? colors.background : '#0f2d5e', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, alignSelf: 'flex-start' }}>
            <Ionicons name="chevron-back" size={18} color="#93b4d8" />
            <Text style={{ color: '#93c5fd', fontSize: font.size.sm, marginLeft: 2 }}>Back</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: font.size.xl, fontWeight: font.weight.bold, color: '#fff' }}>Log Tracking Event</Text>
          {shipment ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Text style={{ color: '#93c5fd', fontSize: font.size.xs, fontWeight: font.weight.bold, fontVariant: ['tabular-nums'] }}>{shipment.tracking_number}</Text>
              <Text style={{ color: '#60a5fa', fontSize: font.size.xs, marginHorizontal: 4 }}>·</Text>
              <Text style={{ color: '#93c5fd', fontSize: font.size.xs, flex: 1 }} numberOfLines={1}>{shipment.route.origin} → {shipment.route.destination}</Text>
            </View>
          ) : null}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: colors.card, borderRadius: radius['2xl'], shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2, overflow: 'hidden' }}>
            {/* Event type */}
            <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                Event Type <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {EVENT_TYPES.map((opt) => {
                  const sel = eventType === opt.value
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => { setEventType(opt.value); setErrors((e) => ({ ...e, eventType: undefined })) }}
                      style={[{
                        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.md, borderWidth: 1.5,
                      }, sel ? {
                        borderColor: isDark ? '#f5801e' : '#0f2d5e', backgroundColor: isDark ? '#f5801e' : '#0f2d5e',
                      } : {
                        borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? colors.muted : '#fff',
                      }]}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={opt.icon} size={13} color={sel ? '#fff' : '#6b7280'} style={{ marginRight: 5 }} />
                      <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: sel ? '#fff' : (isDark ? '#cbd5e1' : '#334155') }}>{opt.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {errors.eventType ? <Text style={{ fontSize: font.size.xs, color: '#EF4444', marginTop: 6 }}>{errors.eventType}</Text> : null}
            </View>

            {/* Location */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Location <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                value={location}
                onChangeText={(v) => { setLocation(v); setErrors((e) => ({ ...e, location: undefined })) }}
                placeholder="e.g. Mombasa Port Gate 3"
                placeholderTextColor="#9ca3af"
                style={[{
                  borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: font.size.sm, color: colors.text,
                }, errors.location ? {
                  borderColor: '#fca5a5', backgroundColor: isDark ? 'rgba(127,29,29,0.2)' : '#fef2f2',
                } : {
                  borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? colors.muted : '#f8fafc',
                }]}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {errors.location ? <Text style={{ fontSize: font.size.xs, color: '#EF4444', marginTop: 4 }}>{errors.location}</Text> : null}
            </View>

            {/* Notes */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
              <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Notes{' '}
                <Text style={{ color: isDark ? '#64748b' : '#94a3b8', fontWeight: font.weight.normal, textTransform: 'none' }}>(optional)</Text>
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional context about this event…"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0', borderRadius: radius.md,
                  paddingHorizontal: 12, paddingVertical: 10, fontSize: font.size.sm, color: colors.text,
                  backgroundColor: isDark ? colors.muted : '#f8fafc',
                  textAlignVertical: 'top', minHeight: 80,
                }}
              />
            </View>
          </View>

          {/* Submit */}
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            <Button variant="primary" size="lg" loading={submitting} onPress={handleSubmit} icon="checkmark-circle-outline">
              Submit Event
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
