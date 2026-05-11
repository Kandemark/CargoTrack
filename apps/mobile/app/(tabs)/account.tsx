import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, RefreshControl, Switch, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { apiClient } from '@/lib/api'
import { useAuthStore, useAlertStore } from '@/lib/store'
import { useAppTheme } from '@/lib/useAppTheme'
import { ALERT_SEVERITY_COLORS } from '@shared/utils/statusColors'
import { SectionLabel, StatusBadge } from '@/components/ui'
import ConnectionCenter from '@/components/ConnectionCenter'
import type { AlertSeverity } from '@shared/api/types'

// ── Types ───────────────────────────────────────────────────────────────────────

type NotificationItem = {
  id: number; title: string; message: string; created_at: string; is_read: boolean
}
type InvoiceLite = {
  id: number; invoice_number: string; amount_kes: string; currency: string; status: string; shipment_tracking: string
}
type ComplianceLite = {
  id: number; tracking_number: string; doc_type_display: string; status_display: string; days_until_expiry: number | null
}
type FleetStats = {
  trucks: number; trucks_active: number; drivers: number; drivers_on_route: number; fleet_utilisation: number
}
type CarrierLite = {
  id: number; name: string; code: string; rating: number; on_time_rate: number; active_shipments: number
}
type IntegrationLite = {
  id: number; name: string; category: string; status: string
}
type AuditLite = {
  id: number; action: string; result: string; description: string; created_at: string; full_name?: string
}
type AccountData = {
  notifications: NotificationItem[]; invoices: InvoiceLite[]; compliance: ComplianceLite[]
  fleet: FleetStats | null; carriers: CarrierLite[]; integrations: IntegrationLite[]
  audit: AuditLite[]; prefs: Record<string, boolean>
}

// ── Stat tile ───────────────────────────────────────────────────────────────────

const STAT_SPECS: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; accent: string; bg: string; darkBg: string }> = {
  alerts:  { icon: 'warning',           accent: '#f97316', bg: '#fff7ed', darkBg: 'rgba(249,115,22,0.12)' },
  inbox:   { icon: 'mail',              accent: '#7c3aed', bg: '#faf5ff', darkBg: 'rgba(124,58,237,0.12)' },
  invoices:{ icon: 'receipt',           accent: '#0f766e', bg: '#f0fdfa', darkBg: 'rgba(15,118,110,0.12)' },
  docs:    { icon: 'document-text',     accent: '#dc2626', bg: '#fef2f2', darkBg: 'rgba(220,38,38,0.12)' },
}

function StatTile({ kind, value, sub }: { kind: string; value: string; sub: string }) {
  const { colors, font, radius, isDark } = useAppTheme()
  const spec = STAT_SPECS[kind] ?? STAT_SPECS.alerts
  return (
    <View
      style={{
        flex: 1,
        minWidth: '46%',
        borderRadius: radius.lg,
        padding: 12,
        margin: 4,
        backgroundColor: isDark ? spec.darkBg : spec.bg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Ionicons name={spec.icon} size={14} color={spec.accent} />
        <Text style={{ fontSize: 10, fontWeight: font.weight.bold, textTransform: 'uppercase', color: spec.accent }}>{sub}</Text>
      </View>
      <Text style={{ fontSize: font.size.xl, fontWeight: font.weight.extrabold, color: colors.text }}>{value}</Text>
    </View>
  )
}

// ── Profile modal ───────────────────────────────────────────────────────────────

function ProfileModal({
  visible, onClose, initial, onSaved,
}: {
  visible: boolean; onClose: () => void
  initial: { first_name: string; last_name: string; phone: string }
  onSaved: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const { colors, font, radius, spacing, isDark } = useAppTheme()

  useEffect(() => { if (visible) setForm(initial) }, [initial, visible])

  async function saveProfile() {
    setSaving(true)
    try {
      await apiClient.patch('/api/v1/accounts/me/', form)
      await onSaved()
      onClose()
    } catch {
      Alert.alert('Update failed', 'Could not save your profile changes.')
    } finally { setSaving(false) }
  }

  const fields: [string, string, string, string][] = [
    ['First name', 'first_name', 'person-outline', 'default'],
    ['Last name', 'last_name', 'person-outline', 'default'],
    ['Phone', 'phone', 'call-outline', 'phone-pad'],
  ]

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: isDark ? colors.background : '#fff' }}>
        <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: font.size.lg, fontWeight: font.weight.extrabold, color: colors.text }}>Edit profile</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {fields.map(([label, key, icon, keyboard]) => (
            <View key={key} style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: isDark ? '#94a3b8' : '#475569', marginBottom: 6 }}>{label}</Text>
              <TextInput
                value={form[key as keyof typeof form]}
                onChangeText={(text) => setForm((prev) => ({ ...prev, [key]: text }))}
                style={{ borderWidth: 1.5, borderColor: isDark ? '#334155' : '#e2e8f0', borderRadius: radius.md, backgroundColor: isDark ? colors.background : '#f8fafc', paddingHorizontal: 14, paddingVertical: 12, fontSize: font.size.sm, color: colors.text }}
                keyboardType={keyboard === 'phone-pad' ? 'phone-pad' : 'default'}
              />
            </View>
          ))}
          <TouchableOpacity
            onPress={() => void saveProfile()}
            style={{ backgroundColor: isDark ? '#f5801e' : '#0f2d5e', borderRadius: radius.md, alignItems: 'center', paddingVertical: 14, marginTop: 8 }}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: '#fff' }}>Save changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ── Card wrapper ────────────────────────────────────────────────────────────────

function SectionCard({ children, style }: { children: React.ReactNode; style?: any }) {
  const { colors, radius, isDark } = useAppTheme()
  return (
    <View
      style={[{
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: radius.xl,
        backgroundColor: isDark ? colors.card : '#fff',
        borderWidth: 1,
        borderColor: isDark ? '#1e293b' : '#f1f5f9',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      }, style]}
    >
      {children}
    </View>
  )
}

// ── Main screen ─────────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const { colors, font, radius, spacing, isDark } = useAppTheme()
  const { user, logout, setUser } = useAuthStore()
  const { alerts, isLoading, fetchAlerts, acknowledgeLocal } = useAlertStore()
  const [data, setData] = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)

  const canAck = user?.role === 'LOGISTICS_MGR' || user?.role === 'ADMIN'
  const canSeeManagerData = canAck

  const load = useCallback(async () => {
    const safeGet = async <T,>(url: string) => {
      try { const res = await apiClient.get<T>(url); return res.data } catch { return null }
    }
    setLoading(true)
    await fetchAlerts(apiClient)
    const [
      notificationsData, invoicesData, complianceData, fleetData, carriersData,
      integrationsData, auditData, prefsData, meData,
    ] = await Promise.all([
      safeGet<{ results?: NotificationItem[] } | NotificationItem[]>('/api/v1/notifications/?page_size=6'),
      safeGet<{ results?: InvoiceLite[] } | InvoiceLite[]>('/api/v1/invoices/?page_size=10'),
      safeGet<{ results?: ComplianceLite[] } | ComplianceLite[]>('/api/v1/compliance/?page_size=10'),
      safeGet<FleetStats>('/api/v1/fleet/stats/'),
      safeGet<{ results?: CarrierLite[] } | CarrierLite[]>('/api/v1/carriers/?page_size=6'),
      canSeeManagerData ? safeGet<{ results?: IntegrationLite[] } | IntegrationLite[]>('/api/v1/integrations/?page_size=6') : Promise.resolve(null),
      canSeeManagerData ? safeGet<{ results?: AuditLite[] } | AuditLite[]>('/api/v1/audit/?page_size=5') : Promise.resolve(null),
      safeGet<Record<string, boolean>>('/api/v1/accounts/notification-prefs/'),
      safeGet<typeof user>('/api/v1/accounts/me/'),
    ])
    if (meData) setUser(meData)
    setData({
      notifications: Array.isArray(notificationsData) ? notificationsData : notificationsData?.results ?? [],
      invoices: Array.isArray(invoicesData) ? invoicesData : invoicesData?.results ?? [],
      compliance: Array.isArray(complianceData) ? complianceData : complianceData?.results ?? [],
      fleet: fleetData,
      carriers: Array.isArray(carriersData) ? carriersData : carriersData?.results ?? [],
      integrations: Array.isArray(integrationsData) ? integrationsData : integrationsData?.results ?? [],
      audit: Array.isArray(auditData) ? auditData : auditData?.results ?? [],
      prefs: prefsData ?? { email_alerts: true, sms_alerts: false, push_alerts: true, daily_digest: true },
    })
    setLoading(false)
  }, [canSeeManagerData, fetchAlerts, setUser, user])

  useEffect(() => { void load() }, [load])

  async function handleLogout() {
    Alert.alert('Sign out', 'End your current session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        await logout()
        router.replace('/(auth)/login')
      }},
    ])
  }

  async function handleAcknowledge(id: number) {
    try { await apiClient.post(`/api/v1/alerts/${id}/acknowledge/`); acknowledgeLocal(id) }
    catch { Alert.alert('Error', 'Could not acknowledge alert.') }
  }

  async function togglePref(key: string, value: boolean) {
    if (!data) return
    const next = { ...data.prefs, [key]: value }
    setData({ ...data, prefs: next })
    try { await apiClient.patch('/api/v1/accounts/notification-prefs/', { [key]: value }) }
    catch { setData({ ...data, prefs: data.prefs }); Alert.alert('Update failed', 'Could not save notification preference.') }
  }

  async function markNotificationRead(id: number) {
    if (!data) return
    try {
      await apiClient.patch(`/api/v1/notifications/${id}/read/`)
      setData({ ...data, notifications: data.notifications.map((item) => (item.id === id ? { ...item, is_read: true } : item)) })
    } catch { Alert.alert('Error', 'Could not update notification.') }
  }

  const unacked = alerts.filter((a) => !a.acknowledged)
  const unreadNotifications = data?.notifications.filter((n) => !n.is_read).length ?? 0
  const expiringDocs = data?.compliance.filter((doc) => doc.days_until_expiry !== null && doc.days_until_expiry <= 14).length ?? 0
  const openInvoices = data?.invoices.filter((inv) => inv.status === 'PENDING' || inv.status === 'FAILED').length ?? 0
  const initials = (user?.first_name?.[0] ?? user?.username?.[0] ?? '?').toUpperCase()
  const displayName = user?.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user?.username ?? ''
  const prefEntries = useMemo(() => data ? Object.entries(data.prefs) : [], [data])

  const PREF_LABELS: Record<string, { label: string; desc: string }> = {
    email_alerts:  { label: 'Email alerts',  desc: 'Critical alerts and daily summaries by email' },
    sms_alerts:    { label: 'SMS alerts',    desc: 'Urgent delay and customs notifications via SMS' },
    push_alerts:   { label: 'Push alerts',   desc: 'Real-time shipment updates on your device' },
    daily_digest:  { label: 'Daily digest',  desc: 'End-of-day summary of all shipment activity' },
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading || isLoading} onRefresh={() => void load()} tintColor="#f5801e" />}
      >
        {/* ═══ Profile header ═══════════════════════════════════════════════════ */}
        <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Avatar */}
            <View style={{
              width: 56, height: 56, borderRadius: radius.xl, backgroundColor: '#f5801e',
              alignItems: 'center', justifyContent: 'center', marginRight: 16,
              shadowColor: '#f5801e', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
            }}>
              <Text style={{ color: '#fff', fontSize: font.size.xl, fontWeight: font.weight.extrabold }}>{initials}</Text>
            </View>

            {/* Name + details */}
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: font.size.lg, fontWeight: font.weight.extrabold, color: colors.text }} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={{ fontSize: font.size.sm, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                {user?.email}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <View style={{ backgroundColor: isDark ? 'rgba(30,58,138,0.3)' : '#eff6ff', borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: font.weight.extrabold, color: isDark ? '#93c5fd' : '#1d4ed8' }}>{user?.role ?? 'User'}</Text>
                </View>
                {user?.org_name ? (
                  <Text style={{ fontSize: 10, color: colors.textFaint }} numberOfLines={1}>
                    {user.org_name}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Edit button */}
            <TouchableOpacity
              onPress={() => setProfileOpen(true)}
              style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 9999, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ Stat tiles ══════════════════════════════════════════════════════ */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12, marginBottom: 4 }}>
          <StatTile kind="alerts"   value={String(unacked.length)}         sub="Open alerts" />
          <StatTile kind="inbox"    value={String(unreadNotifications)}    sub="Unread" />
          <StatTile kind="invoices" value={String(openInvoices)}           sub="Open invoices" />
          <StatTile kind="docs"     value={String(expiringDocs)}           sub="Expiring docs" />
        </View>

        {/* ═══ Inbox: Alerts + Notifications ══════════════════════════════════ */}
        <SectionLabel label="Inbox" style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 8 }} />

        {/* Alerts */}
        <SectionCard>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/alerts')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: STAT_SPECS.alerts.darkBg }}>
                <Ionicons name="warning" size={16} color={STAT_SPECS.alerts.accent} />
              </View>
              <View>
                <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text }}>Alerts</Text>
                <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>
                  {unacked.length === 0 ? 'All clear' : `${unacked.length} need attention`}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {unacked.length > 0 && (
                <View style={{ backgroundColor: '#f5801e', borderRadius: 9999, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: font.weight.extrabold, color: '#fff' }}>{unacked.length}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
            </View>
          </TouchableOpacity>

          {/* Inline alert previews */}
          {unacked.slice(0, 2).map((item) => {
            const alertColors = ALERT_SEVERITY_COLORS[item.severity] ?? ALERT_SEVERITY_COLORS.LOW
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push('/(tabs)/alerts')}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderColor: isDark ? '#1e293b' : '#f8fafc' }}
                activeOpacity={0.7}
              >
                <View style={{ width: 3, height: 28, borderRadius: 9999, marginRight: 12, backgroundColor: alertColors.dot }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: colors.text }} numberOfLines={1}>
                    {item.shipment_tracking}
                  </Text>
                  <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }} numberOfLines={1}>
                    {item.message}
                  </Text>
                </View>
                {canAck && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); void handleAcknowledge(item.id) }}
                    style={{ marginLeft: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1, borderColor: isDark ? '#f5801e' : '#0f2d5e' }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: font.weight.bold, color: isDark ? '#f5801e' : '#0f2d5e' }}>Ack</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )
          })}
        </SectionCard>

        {/* Notifications */}
        <SectionCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: STAT_SPECS.inbox.darkBg }}>
                <Ionicons name="mail" size={16} color={STAT_SPECS.inbox.accent} />
              </View>
              <View>
                <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text }}>Notifications</Text>
                <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>
                  {unreadNotifications === 0 ? 'All read' : `${unreadNotifications} unread`}
                </Text>
              </View>
            </View>
            {unreadNotifications > 0 && (
              <View style={{ backgroundColor: isDark ? 'rgba(88,28,135,0.3)' : '#f3e8ff', borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: font.weight.extrabold, color: isDark ? '#d8b4fe' : '#7e22ce' }}>{unreadNotifications} new</Text>
              </View>
            )}
          </View>
          {(data?.notifications ?? []).slice(0, 3).map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => void markNotificationRead(item.id)}
              style={{ paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderColor: isDark ? '#1e293b' : '#f8fafc', flexDirection: 'row', alignItems: 'flex-start' }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {!item.is_read && <View style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: '#f5801e' }} />}
                  <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: colors.text }} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 4 }}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {(data?.notifications.length ?? 0) === 0 && (
            <Text style={{ fontSize: font.size.sm, color: colors.textMuted, paddingHorizontal: 16, paddingVertical: 12 }}>No notifications yet.</Text>
          )}
        </SectionCard>

        {/* ═══ Notification preferences ════════════════════════════════════════ */}
        <SectionLabel label="Preferences" style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 8 }} />
        <SectionCard>
          {prefEntries.map(([key, enabled], i) => {
            const info = PREF_LABELS[key] ?? { label: key.replace(/_/g, ' '), desc: 'Notification channel preference' }
            const isLast = i === prefEntries.length - 1
            return (
              <View
                key={key}
                style={[{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 16, paddingVertical: 12,
                }, !isLast && { borderBottomWidth: 1, borderColor: isDark ? '#1e293b' : '#f8fafc' }]}
              >
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.text, textTransform: 'capitalize' }}>{info.label}</Text>
                  <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>{info.desc}</Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={(value) => void togglePref(key, value)}
                  trackColor={{ true: '#f5801e', false: '#d1d5db' }}
                  thumbColor={enabled ? '#fff' : '#f9fafb'}
                />
              </View>
            )
          })}
        </SectionCard>

        {/* ═══ Finance & Compliance ════════════════════════════════════════════ */}
        <SectionLabel label="Finance & compliance" style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 8 }} />

        {/* Payments */}
        <SectionCard>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/payments')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: STAT_SPECS.invoices.darkBg }}>
                <Ionicons name="receipt" size={16} color={STAT_SPECS.invoices.accent} />
              </View>
              <View>
                <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text }}>Payments</Text>
                <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>
                  {openInvoices > 0 ? `${openInvoices} invoices pending` : 'All settled'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
          </TouchableOpacity>
          {(data?.invoices ?? []).slice(0, 2).map((inv) => (
            <TouchableOpacity
              key={inv.id}
              onPress={() => router.push('/(tabs)/payments')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderColor: isDark ? '#1e293b' : '#f8fafc' }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.extrabold, color: colors.text }}>{inv.invoice_number}</Text>
                <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>{inv.shipment_tracking}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text }}>
                  {Number(inv.amount_kes).toLocaleString()} {inv.currency}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: font.weight.bold, color: inv.status === 'PAID' ? (isDark ? '#34d399' : '#059669') : '#f5801e' }}>
                  {inv.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </SectionCard>

        {/* Documents */}
        <SectionCard>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/documents')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: STAT_SPECS.docs.darkBg }}>
                <Ionicons name="document-text" size={16} color={STAT_SPECS.docs.accent} />
              </View>
              <View>
                <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text }}>Documents</Text>
                <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>
                  {expiringDocs > 0 ? `${expiringDocs} expiring soon` : 'All up to date'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
          </TouchableOpacity>
          {(data?.compliance ?? []).slice(0, 2).map((doc) => (
            <View
              key={doc.id}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderColor: isDark ? '#1e293b' : '#f8fafc' }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.extrabold, color: colors.text }}>{doc.tracking_number}</Text>
                <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>{doc.doc_type_display}</Text>
              </View>
              <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.extrabold, color: (doc.days_until_expiry ?? 999) <= 14 ? '#EF4444' : (isDark ? '#34d399' : '#059669') }}>
                {doc.days_until_expiry === null ? doc.status_display : `${doc.days_until_expiry}d`}
              </Text>
            </View>
          ))}
        </SectionCard>

        {/* ═══ Network operations ══════════════════════════════════════════════ */}
        <SectionLabel label="Network operations" style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 8 }} />
        <ConnectionCenter />

        {/* Fleet + Carriers */}
        <SectionCard>
          {data?.fleet ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: isDark ? '#1e293b' : '#f8fafc' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Ionicons name="bus" size={16} color="#3b82f6" />
                <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text }}>Fleet</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <View style={{ width: '50%', marginBottom: 8 }}>
                  <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, color: colors.text }}>
                    {data.fleet.trucks_active}
                    <Text style={{ fontSize: font.size.sm, color: colors.textFaint }}>/{data.fleet.trucks}</Text>
                  </Text>
                  <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>Trucks active</Text>
                </View>
                <View style={{ width: '50%', marginBottom: 8 }}>
                  <Text style={{ fontSize: font.size['2xl'], fontWeight: font.weight.extrabold, color: colors.text }}>
                    {data.fleet.drivers_on_route}
                    <Text style={{ fontSize: font.size.sm, color: colors.textFaint }}>/{data.fleet.drivers}</Text>
                  </Text>
                  <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>Drivers on route</Text>
                </View>
                <View style={{ width: '100%' }}>
                  <View style={{ height: 6, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 9999, overflow: 'hidden' }}>
                    <View style={{ height: '100%', backgroundColor: '#3b82f6', borderRadius: 9999, width: `${Math.min(100, data.fleet.fleet_utilisation)}%` }} />
                  </View>
                  <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 4 }}>{data.fleet.fleet_utilisation}% utilisation</Text>
                </View>
              </View>
            </View>
          ) : null}
          {(data?.carriers ?? []).slice(0, 3).map((carrier, i) => {
            const isLast = i === Math.min((data?.carriers ?? []).length, 3) - 1
            return (
              <View
                key={carrier.id}
                style={[{ paddingHorizontal: 16, paddingVertical: 12 }, !isLast && { borderBottomWidth: 1, borderColor: isDark ? '#1e293b' : '#f8fafc' }]}
              >
                <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: colors.text }}>{carrier.name}</Text>
                <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>
                  {carrier.code} · {carrier.rating.toFixed(1)}★ · {carrier.on_time_rate}% on time · {carrier.active_shipments} loads
                </Text>
              </View>
            )
          })}
        </SectionCard>

        {/* ═══ Manager-only sections ═══════════════════════════════════════════ */}
        {canSeeManagerData && (
          <>
            <SectionLabel label="Integrations" style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 8 }} />
            <SectionCard>
              {(data?.integrations ?? []).length === 0 ? (
                <Text style={{ fontSize: font.size.sm, color: colors.textMuted, paddingHorizontal: 16, paddingVertical: 12 }}>No integrations configured.</Text>
              ) : (
                data?.integrations.slice(0, 4).map((integration, i) => {
                  const isLast = i === Math.min((data?.integrations ?? []).length, 4) - 1
                  return (
                    <View
                      key={integration.id}
                      style={[{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 16, paddingVertical: 12,
                      }, !isLast && { borderBottomWidth: 1, borderColor: isDark ? '#1e293b' : '#f8fafc' }]}
                    >
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.extrabold, color: colors.text }}>{integration.name}</Text>
                        <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>{integration.category}</Text>
                      </View>
                      <View style={{
                        borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 2,
                        backgroundColor: integration.status === 'ACTIVE'
                          ? (isDark ? 'rgba(6,78,59,0.2)' : '#ecfdf5')
                          : (isDark ? 'rgba(124,45,18,0.2)' : '#fff7ed'),
                      }}>
                        <Text style={{
                          fontSize: 10, fontWeight: font.weight.extrabold,
                          color: integration.status === 'ACTIVE'
                            ? (isDark ? '#34d399' : '#059669')
                            : '#f5801e',
                        }}>
                          {integration.status}
                        </Text>
                      </View>
                    </View>
                  )
                })
              )}
            </SectionCard>

            <SectionLabel label="Audit trail" style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 8 }} />
            <SectionCard>
              {(data?.audit ?? []).length === 0 ? (
                <Text style={{ fontSize: font.size.sm, color: colors.textMuted, paddingHorizontal: 16, paddingVertical: 12 }}>No audit items available.</Text>
              ) : (
                data?.audit.slice(0, 4).map((item, i) => {
                  const isLast = i === Math.min((data?.audit ?? []).length, 4) - 1
                  return (
                    <View
                      key={item.id}
                      style={[{ paddingHorizontal: 16, paddingVertical: 12 }, !isLast && { borderBottomWidth: 1, borderColor: isDark ? '#1e293b' : '#f8fafc' }]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.extrabold, color: colors.text }}>{item.action}</Text>
                        <Text style={{ fontSize: 10, color: colors.textFaint }}>· {item.result}</Text>
                      </View>
                      <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }} numberOfLines={2}>
                        {item.description}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 4 }}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                  )
                })
              )}
            </SectionCard>
          </>
        )}

        {/* ═══ Sign out ════════════════════════════════════════════════════════ */}
        <View style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl,
              paddingHorizontal: 16, paddingVertical: 14,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(127,29,29,0.3)' : '#fee2e2',
              backgroundColor: isDark ? colors.card : '#fff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
              elevation: 1,
            }}
            activeOpacity={0.7}
          >
            <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: isDark ? 'rgba(127,29,29,0.2)' : '#fef2f2', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.extrabold, color: isDark ? '#f87171' : '#dc2626' }}>Sign out</Text>
              <Text style={{ fontSize: font.size.xs, color: colors.textFaint, marginTop: 2 }}>End your current session</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: 'center', fontSize: font.size.xs, color: colors.textFaint, marginTop: 8 }}>
          CargoTrack v1.0 · East Africa Logistics Intelligence
        </Text>
      </ScrollView>

      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        initial={{ first_name: user?.first_name ?? '', last_name: user?.last_name ?? '', phone: user?.phone ?? '' }}
        onSaved={async () => {
          const res = await apiClient.get('/api/v1/accounts/me/')
          setUser(res.data)
          await load()
        }}
      />
    </SafeAreaView>
  )
}
