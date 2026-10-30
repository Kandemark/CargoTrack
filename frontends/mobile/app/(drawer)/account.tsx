import { useCallback, useEffect, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, Switch, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { useBack } from '@/lib/useBack'
import { useAppTheme } from '@/lib/useAppTheme'
import { day } from '@/lib/data'
import { Button, KeyValue, ListRow, ScreenFrame, Section, Txt } from '@/components/ui'

const PREFS: { key: string; label: string; desc: string }[] = [
  { key: 'push_alerts', label: 'Push notifications', desc: 'Delays, customs holds and deliveries on this phone' },
  { key: 'sms_alerts', label: 'SMS', desc: 'Urgent delays and customs holds by text message' },
  { key: 'email_alerts', label: 'Email', desc: 'Critical alerts and receipts by email' },
  { key: 'daily_digest', label: 'Daily summary', desc: 'One email at the end of each day' },
]

/**
 * You and your settings: profile, password, how you are notified, and
 * signing out. Everything about shipments and money lives on its own screen.
 */
export default function AccountScreen() {
  const back = useBack()
  const { user, logout, setUser } = useAuthStore()
  const { brand } = useAppTheme()
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<Record<string, boolean>>('/api/v1/accounts/notification-prefs/')
      setPrefs(res.data ?? {})
    } catch { /* keep defaults */ }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(key: string, value: boolean) {
    const before = prefs
    setPrefs({ ...prefs, [key]: value })
    try {
      await apiClient.patch('/api/v1/accounts/notification-prefs/', { [key]: value })
    } catch {
      setPrefs(before)
      Alert.alert('Not saved', 'Check your connection and try again.')
    }
  }

  function signOut() {
    Alert.alert('Sign out?', 'You will need your password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login') } },
    ])
  }

  const name = user ? `${user.first_name} ${user.last_name}`.trim() || user.username : ''
  const initials = user ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || (user.username?.[0] ?? '?').toUpperCase() : '?'

  return (
    <ScreenFrame
      eyebrow={user?.org_name ?? undefined}
      title={name}
      subtitle={user?.role_display}
      onBack={back}
      trailing={
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: brand.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="title" tone="inverse">{initials}</Txt>
        </View>
      }>
      <Section label="Profile" action="Edit" onAction={() => setEditing(true)}>
        <KeyValue label="Email" value={user?.email || '—'} />
        <KeyValue label="Phone" value={user?.phone || 'Not added'} />
        <KeyValue label="Username" value={user?.username ?? '—'} />
        <KeyValue label="Member since" value={day((user as { date_joined?: string } | null)?.date_joined)} last />
      </Section>

      <Section label="Notify me by">
        {PREFS.map((p, i) => (
          <PrefRow key={p.key} label={p.label} desc={p.desc} value={prefs[p.key] ?? true} onChange={(v) => toggle(p.key, v)} last={i === PREFS.length - 1} />
        ))}
      </Section>

      <Section label="Security">
        <ListRow icon="key-outline" title="Change password" onPress={() => setChangingPassword(true)} />
        <ListRow icon="log-out-outline" title="Sign out" onPress={signOut} last />
      </Section>

      {editing && user ? (
        <ProfileSheet
          initial={{ first_name: user.first_name, last_name: user.last_name, phone: user.phone ?? '' }}
          onClose={() => setEditing(false)}
          onSaved={(u) => { setUser({ ...user, ...u }); setEditing(false) }}
        />
      ) : null}
      {changingPassword ? <PasswordSheet onClose={() => setChangingPassword(false)} /> : null}
    </ScreenFrame>
  )
}

function PrefRow({ label, desc, value, onChange, last }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void; last: boolean }) {
  const { colors, brand } = useAppTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: colors.borderMid }}>
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">{label}</Txt>
        <Txt variant="caption" tone="muted" style={{ marginTop: 2 }}>{desc}</Txt>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: brand.accent, false: colors.border }} thumbColor="#FFFFFF" />
    </View>
  )
}

function Field({ label, value, onChange, secure, keyboard }: { label: string; value: string; onChange: (v: string) => void; secure?: boolean; keyboard?: 'default' | 'phone-pad' }) {
  const { colors } = useAppTheme()
  return (
    <View>
      <Txt variant="label" tone="faint" style={{ marginBottom: 8 }}>{label}</Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize={secure ? 'none' : 'words'}
        style={{ borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.muted, color: colors.text, fontFamily: 'DMSans-Medium', fontSize: 16 }}
      />
    </View>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { colors } = useAppTheme()
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
          <Txt variant="title" style={{ flex: 1 }}>{title}</Txt>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function ProfileSheet({ initial, onClose, onSaved }: { initial: { first_name: string; last_name: string; phone: string }; onClose: () => void; onSaved: (u: typeof initial) => void }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    try {
      await apiClient.patch('/api/v1/accounts/me/', form)
      onSaved(form)
    } catch {
      Alert.alert('Not saved', 'Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Sheet title="Edit profile" onClose={onClose}>
      <Field label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
      <Field label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
      <Field label="Phone" value={form.phone} keyboard="phone-pad" onChange={(v) => setForm({ ...form, phone: v })} />
      <Button variant="primary" onPress={save} loading={saving}>Save</Button>
    </Sheet>
  )
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    if (next.length < 8) { Alert.alert('Too short', 'Use at least 8 characters.'); return }
    setSaving(true)
    try {
      await apiClient.post('/api/v1/accounts/change-password/', { current_password: current, new_password: next })
      Alert.alert('Password changed', 'Use the new password next time you sign in.')
      onClose()
    } catch {
      Alert.alert('Not changed', 'Check your current password and try again.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Sheet title="Change password" onClose={onClose}>
      <Field label="Current password" value={current} onChange={setCurrent} secure />
      <Field label="New password" value={next} onChange={setNext} secure />
      <Button variant="primary" onPress={save} loading={saving} disabled={!current || !next}>Change password</Button>
    </Sheet>
  )
}
