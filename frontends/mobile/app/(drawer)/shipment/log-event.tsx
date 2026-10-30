import { useEffect, useState, type ComponentProps } from 'react'
import { Alert, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { shipmentsApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import { Button, Chip, Empty, ScreenFrame, Section, Txt } from '@/components/ui'
import type { Shipment } from '@shared/api/types'

const ROLES = new Set(['DRIVER', 'DISPATCHER', 'LOGISTICS_MGR', 'ADMIN', 'CARRIER', 'CUSTOMS_BROKER', 'PORT_AGENT', 'WAREHOUSE_MGR'])

type Kind = 'DEPARTURE' | 'CHECKPOINT' | 'CUSTOMS_ENTRY' | 'CUSTOMS_CLEAR' | 'ARRIVAL' | 'DELAY' | 'NOTE'

const KINDS: { value: Kind; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'DEPARTURE', label: 'Departed', icon: 'navigate-outline' },
  { value: 'CHECKPOINT', label: 'Checkpoint', icon: 'flag-outline' },
  { value: 'CUSTOMS_ENTRY', label: 'At customs', icon: 'document-text-outline' },
  { value: 'CUSTOMS_CLEAR', label: 'Cleared customs', icon: 'checkmark-done-outline' },
  { value: 'DELAY', label: 'Delay', icon: 'time-outline' },
  { value: 'ARRIVAL', label: 'Arrived', icon: 'checkmark-circle-outline' },
  { value: 'NOTE', label: 'Note', icon: 'chatbox-outline' },
]

/** Record what just happened to a shipment: where, what, and an optional note. */
export default function LogEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const shipmentId = Number(id)
  const user = useAuthStore((s) => s.user)
  const { colors } = useAppTheme()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [kind, setKind] = useState<Kind | null>(null)
  const [place, setPlace] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (shipmentId) shipmentsApi.get(shipmentId).then((r) => setShipment(r.data)).catch(() => {})
  }, [shipmentId])

  if (user && !ROLES.has(user.role)) {
    return (
      <ScreenFrame title="Log an update" onBack={() => router.back()}>
        <Empty icon="lock-closed-outline" title="Not available for your role" body="Drivers, dispatchers and managers record shipment updates." />
      </ScreenFrame>
    )
  }

  async function save() {
    if (!kind || !place.trim()) return
    setSaving(true)
    try {
      await shipmentsApi.logEvent(shipmentId, { event_type: kind, location: place.trim(), notes: notes.trim() })
      router.replace(`/shipment/${shipmentId}` as any)
    } catch {
      Alert.alert('Not saved', 'Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const input = { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.muted, color: colors.text, fontFamily: 'DMSans-Medium', fontSize: 16 } as const

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenFrame
        eyebrow={shipment?.tracking_number}
        title="Log an update"
        subtitle={shipment ? `${shipment.route.origin} → ${shipment.route.destination}` : undefined}
        onBack={() => router.back()}>
        <Section label="What happened">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {KINDS.map((k) => <Chip key={k.value} label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} />)}
          </View>
        </Section>
        <Section label="Where">
          <TextInput value={place} onChangeText={setPlace} placeholder="For example, Malaba border" placeholderTextColor={colors.textFaint} style={input} />
        </Section>
        <Section label="Note (optional)">
          <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Anything the team should know" placeholderTextColor={colors.textFaint} style={[input, { minHeight: 100, textAlignVertical: 'top' }]} />
        </Section>
        <View>
          <Button variant="primary" onPress={save} loading={saving} disabled={!kind || !place.trim()}>Save update</Button>
          {!kind || !place.trim() ? <Txt variant="caption" tone="muted" style={{ marginTop: 8, textAlign: 'center' }}>Choose what happened and where.</Txt> : null}
        </View>
      </ScreenFrame>
    </KeyboardAvoidingView>
  )
}
