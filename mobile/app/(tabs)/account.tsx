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
  const spec = STAT_SPECS[kind] ?? STAT_SPECS.alerts
  return (
    <View
      className="flex-1 min-w-[46%] rounded-ct-lg p-3 m-1"
      style={{ backgroundColor: spec.bg }}
    >
      <View className="flex-row items-center gap-1.5 mb-1.5">
        <Ionicons name={spec.icon} size={14} color={spec.accent} />
        <Text className="text-[10px] font-bold uppercase" style={{ color: spec.accent }}>{sub}</Text>
      </View>
      <Text className="text-ct-xl font-extrabold text-ct-text-primary dark:text-white">{value}</Text>
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
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white dark:bg-ct-dark-bg">
        <View className="px-5 py-3.5 border-b border-ct-border-light dark:border-ct-dark-border flex-row items-center justify-between">
          <Text className="text-ct-lg font-extrabold text-ct-text-primary dark:text-ct-dark-text">Edit profile</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {fields.map(([label, key, icon, keyboard]) => (
            <View key={key} className="mb-4">
              <Text className="text-ct-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">{label}</Text>
              <TextInput
                value={form[key as keyof typeof form]}
                onChangeText={(text) => setForm((prev) => ({ ...prev, [key]: text }))}
                className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-ct-md bg-slate-50 dark:bg-ct-dark-surface px-3.5 py-3 text-ct-sm text-ct-text-primary dark:text-ct-dark-text"
                keyboardType={keyboard === 'phone-pad' ? 'phone-pad' : 'default'}
              />
            </View>
          ))}
          <TouchableOpacity
            onPress={() => void saveProfile()}
            className="bg-ct-navy dark:bg-ct-orange rounded-ct-md items-center py-3.5 mt-2"
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-ct-sm font-extrabold text-white">Save changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ── Card wrapper ────────────────────────────────────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <View
      className={`mx-4 mb-3 rounded-ct-xl bg-white dark:bg-ct-dark-card border border-slate-100 dark:border-slate-800 overflow-hidden ${className ?? ''}`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      {children}
    </View>
  )
}

// ── Main screen ─────────────────────────────────────────────────────────────────

export default function AccountScreen() {
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
    <SafeAreaView edges={['top']} className="flex-1 bg-ct-surface-bg dark:bg-ct-dark-bg">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading || isLoading} onRefresh={() => void load()} tintColor="#f5801e" />}
      >
        {/* ═══ Profile header ═══════════════════════════════════════════════════ */}
        <View className="mx-4 mt-4 mb-1">
          <View className="flex-row items-center">
            {/* Avatar */}
            <View className="w-[56px] h-[56px] rounded-ct-xl bg-ct-orange items-center justify-center mr-4"
              style={{
                shadowColor: '#f5801e',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <Text className="text-white text-ct-xl font-extrabold">{initials}</Text>
            </View>

            {/* Name + details */}
            <View className="flex-1 mr-3">
              <Text className="text-ct-lg font-extrabold text-ct-text-primary dark:text-white" numberOfLines={1}>
                {displayName}
              </Text>
              <Text className="text-ct-sm text-ct-text-muted dark:text-slate-400 mt-0.5" numberOfLines={1}>
                {user?.email}
              </Text>
              <View className="flex-row items-center gap-2 mt-1">
                <View className="bg-blue-50 dark:bg-blue-900/30 rounded-full px-2.5 py-0.5">
                  <Text className="text-[10px] font-extrabold text-blue-700 dark:text-blue-300">{user?.role ?? 'User'}</Text>
                </View>
                {user?.org_name ? (
                  <Text className="text-[10px] text-ct-text-faint dark:text-slate-500" numberOfLines={1}>
                    {user.org_name}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Edit button */}
            <TouchableOpacity
              onPress={() => setProfileOpen(true)}
              className="bg-slate-100 dark:bg-slate-800 rounded-full w-[38px] h-[38px] items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ Stat tiles ══════════════════════════════════════════════════════ */}
        <View className="flex-row flex-wrap mx-3 mb-1">
          <StatTile kind="alerts"   value={String(unacked.length)}         sub="Open alerts" />
          <StatTile kind="inbox"    value={String(unreadNotifications)}    sub="Unread" />
          <StatTile kind="invoices" value={String(openInvoices)}           sub="Open invoices" />
          <StatTile kind="docs"     value={String(expiringDocs)}           sub="Expiring docs" />
        </View>

        {/* ═══ Inbox: Alerts + Notifications ══════════════════════════════════ */}
        <SectionLabel label="Inbox" className="px-5 mt-2 mb-2" />

        {/* Alerts */}
        <SectionCard>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/alerts')}
            className="flex-row items-center justify-between px-4 py-3.5"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-2.5">
              <View className="w-[34px] h-[34px] rounded-ct-md items-center justify-center" style={{ backgroundColor: STAT_SPECS.alerts.darkBg }}>
                <Ionicons name="warning" size={16} color={STAT_SPECS.alerts.accent} />
              </View>
              <View>
                <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-white">Alerts</Text>
                <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">
                  {unacked.length === 0 ? 'All clear' : `${unacked.length} need attention`}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1.5">
              {unacked.length > 0 && (
                <View className="bg-ct-orange rounded-full min-w-[22px] h-[22px] items-center justify-center px-1.5">
                  <Text className="text-[10px] font-extrabold text-white">{unacked.length}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
            </View>
          </TouchableOpacity>

          {/* Inline alert previews */}
          {unacked.slice(0, 2).map((item) => {
            const colors = ALERT_SEVERITY_COLORS[item.severity] ?? ALERT_SEVERITY_COLORS.LOW
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push('/(tabs)/alerts')}
                className="flex-row items-center px-4 py-2.5 border-t border-slate-50 dark:border-slate-800"
                activeOpacity={0.7}
              >
                <View className="w-[3px] h-[28px] rounded-full mr-3" style={{ backgroundColor: colors.dot }} />
                <View className="flex-1 min-w-0">
                  <Text className="text-ct-xs font-bold text-ct-text-primary dark:text-white" numberOfLines={1}>
                    {item.shipment_tracking}
                  </Text>
                  <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5" numberOfLines={1}>
                    {item.message}
                  </Text>
                </View>
                {canAck && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); void handleAcknowledge(item.id) }}
                    className="ml-2 px-2.5 py-1 rounded-full border border-ct-navy dark:border-ct-orange"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text className="text-[10px] font-bold text-ct-navy dark:text-ct-orange">Ack</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )
          })}
        </SectionCard>

        {/* Notifications */}
        <SectionCard>
          <View className="flex-row items-center justify-between px-4 pt-3.5 pb-1">
            <View className="flex-row items-center gap-2.5">
              <View className="w-[34px] h-[34px] rounded-ct-md items-center justify-center" style={{ backgroundColor: STAT_SPECS.inbox.darkBg }}>
                <Ionicons name="mail" size={16} color={STAT_SPECS.inbox.accent} />
              </View>
              <View>
                <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-white">Notifications</Text>
                <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">
                  {unreadNotifications === 0 ? 'All read' : `${unreadNotifications} unread`}
                </Text>
              </View>
            </View>
            {unreadNotifications > 0 && (
              <View className="bg-purple-100 dark:bg-purple-900/30 rounded-full px-2 py-0.5">
                <Text className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300">{unreadNotifications} new</Text>
              </View>
            )}
          </View>
          {(data?.notifications ?? []).slice(0, 3).map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => void markNotificationRead(item.id)}
              className="px-4 py-2.5 border-t border-slate-50 dark:border-slate-800 flex-row items-start"
              activeOpacity={0.7}
            >
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-2">
                  {!item.is_read && <View className="w-[6px] h-[6px] rounded-full bg-ct-orange" />}
                  <Text className="text-ct-xs font-bold text-ct-text-primary dark:text-white" numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5" numberOfLines={2}>
                  {item.message}
                </Text>
                <Text className="text-[10px] text-ct-text-faint dark:text-slate-500 mt-1">
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {(data?.notifications.length ?? 0) === 0 && (
            <Text className="text-ct-sm text-ct-text-muted dark:text-slate-400 px-4 py-3">No notifications yet.</Text>
          )}
        </SectionCard>

        {/* ═══ Notification preferences ════════════════════════════════════════ */}
        <SectionLabel label="Preferences" className="px-5 mt-3 mb-2" />
        <SectionCard>
          {prefEntries.map(([key, enabled], i) => {
            const info = PREF_LABELS[key] ?? { label: key.replace(/_/g, ' '), desc: 'Notification channel preference' }
            const isLast = i === prefEntries.length - 1
            return (
              <View
                key={key}
                className={`flex-row items-center justify-between px-4 py-3 ${isLast ? '' : 'border-b border-slate-50 dark:border-slate-800'}`}
              >
                <View className="flex-1 mr-4">
                  <Text className="text-ct-sm font-bold text-ct-text-primary dark:text-white capitalize">{info.label}</Text>
                  <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">{info.desc}</Text>
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
        <SectionLabel label="Finance & compliance" className="px-5 mt-3 mb-2" />

        {/* Payments */}
        <SectionCard>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/payments')}
            className="flex-row items-center justify-between px-4 py-3.5"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-2.5">
              <View className="w-[34px] h-[34px] rounded-ct-md items-center justify-center" style={{ backgroundColor: STAT_SPECS.invoices.darkBg }}>
                <Ionicons name="receipt" size={16} color={STAT_SPECS.invoices.accent} />
              </View>
              <View>
                <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-white">Payments</Text>
                <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">
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
              className="flex-row items-center justify-between px-4 py-2.5 border-t border-slate-50 dark:border-slate-800"
              activeOpacity={0.7}
            >
              <View className="flex-1">
                <Text className="text-ct-xs font-extrabold text-ct-text-primary dark:text-white">{inv.invoice_number}</Text>
                <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">{inv.shipment_tracking}</Text>
              </View>
              <View className="items-end">
                <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-white">
                  {Number(inv.amount_kes).toLocaleString()} {inv.currency}
                </Text>
                <Text className={`text-[10px] font-bold ${inv.status === 'PAID' ? 'text-emerald-600 dark:text-emerald-400' : 'text-ct-orange'}`}>
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
            className="flex-row items-center justify-between px-4 py-3.5"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-2.5">
              <View className="w-[34px] h-[34px] rounded-ct-md items-center justify-center" style={{ backgroundColor: STAT_SPECS.docs.darkBg }}>
                <Ionicons name="document-text" size={16} color={STAT_SPECS.docs.accent} />
              </View>
              <View>
                <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-white">Documents</Text>
                <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">
                  {expiringDocs > 0 ? `${expiringDocs} expiring soon` : 'All up to date'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
          </TouchableOpacity>
          {(data?.compliance ?? []).slice(0, 2).map((doc) => (
            <View
              key={doc.id}
              className="flex-row items-center justify-between px-4 py-2.5 border-t border-slate-50 dark:border-slate-800"
            >
              <View className="flex-1">
                <Text className="text-ct-xs font-extrabold text-ct-text-primary dark:text-white">{doc.tracking_number}</Text>
                <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">{doc.doc_type_display}</Text>
              </View>
              <Text className={`text-ct-xs font-extrabold ${(doc.days_until_expiry ?? 999) <= 14 ? 'text-ct-danger' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {doc.days_until_expiry === null ? doc.status_display : `${doc.days_until_expiry}d`}
              </Text>
            </View>
          ))}
        </SectionCard>

        {/* ═══ Network operations ══════════════════════════════════════════════ */}
        <SectionLabel label="Network operations" className="px-5 mt-3 mb-2" />
        <ConnectionCenter />

        {/* Fleet + Carriers */}
        <SectionCard>
          {data?.fleet ? (
            <View className="px-4 py-3.5 border-b border-slate-50 dark:border-slate-800">
              <View className="flex-row items-center gap-2.5 mb-2">
                <Ionicons name="bus" size={16} color="#3b82f6" />
                <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-white">Fleet</Text>
              </View>
              <View className="flex-row flex-wrap">
                <View className="w-1/2 mb-2">
                  <Text className="text-ct-2xl font-extrabold text-ct-text-primary dark:text-white">{data.fleet.trucks_active}<Text className="text-ct-sm text-ct-text-faint dark:text-slate-400">/{data.fleet.trucks}</Text></Text>
                  <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">Trucks active</Text>
                </View>
                <View className="w-1/2 mb-2">
                  <Text className="text-ct-2xl font-extrabold text-ct-text-primary dark:text-white">{data.fleet.drivers_on_route}<Text className="text-ct-sm text-ct-text-faint dark:text-slate-400">/{data.fleet.drivers}</Text></Text>
                  <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">Drivers on route</Text>
                </View>
                <View className="w-full">
                  <View className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <View className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, data.fleet.fleet_utilisation)}%` }} />
                  </View>
                  <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-1">{data.fleet.fleet_utilisation}% utilisation</Text>
                </View>
              </View>
            </View>
          ) : null}
          {(data?.carriers ?? []).slice(0, 3).map((carrier, i) => {
            const isLast = i === Math.min((data?.carriers ?? []).length, 3) - 1
            return (
              <View
                key={carrier.id}
                className={`px-4 py-3 ${isLast ? '' : 'border-b border-slate-50 dark:border-slate-800'}`}
              >
                <Text className="text-ct-sm font-extrabold text-ct-text-primary dark:text-white">{carrier.name}</Text>
                <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">
                  {carrier.code} · {carrier.rating.toFixed(1)}★ · {carrier.on_time_rate}% on time · {carrier.active_shipments} loads
                </Text>
              </View>
            )
          })}
        </SectionCard>

        {/* ═══ Manager-only sections ═══════════════════════════════════════════ */}
        {canSeeManagerData && (
          <>
            <SectionLabel label="Integrations" className="px-5 mt-3 mb-2" />
            <SectionCard>
              {(data?.integrations ?? []).length === 0 ? (
                <Text className="text-ct-sm text-ct-text-muted dark:text-slate-400 px-4 py-3">No integrations configured.</Text>
              ) : (
                data?.integrations.slice(0, 4).map((integration, i) => {
                  const isLast = i === Math.min((data?.integrations ?? []).length, 4) - 1
                  return (
                    <View
                      key={integration.id}
                      className={`flex-row items-center justify-between px-4 py-3 ${isLast ? '' : 'border-b border-slate-50 dark:border-slate-800'}`}
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-ct-xs font-extrabold text-ct-text-primary dark:text-white">{integration.name}</Text>
                        <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5">{integration.category}</Text>
                      </View>
                      <View className={`rounded-full px-2.5 py-0.5 ${integration.status === 'ACTIVE' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
                        <Text className={`text-[10px] font-extrabold ${integration.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-ct-orange'}`}>
                          {integration.status}
                        </Text>
                      </View>
                    </View>
                  )
                })
              )}
            </SectionCard>

            <SectionLabel label="Audit trail" className="px-5 mt-3 mb-2" />
            <SectionCard>
              {(data?.audit ?? []).length === 0 ? (
                <Text className="text-ct-sm text-ct-text-muted dark:text-slate-400 px-4 py-3">No audit items available.</Text>
              ) : (
                data?.audit.slice(0, 4).map((item, i) => {
                  const isLast = i === Math.min((data?.audit ?? []).length, 4) - 1
                  return (
                    <View
                      key={item.id}
                      className={`px-4 py-3 ${isLast ? '' : 'border-b border-slate-50 dark:border-slate-800'}`}
                    >
                      <View className="flex-row items-center gap-2">
                        <Text className="text-ct-xs font-extrabold text-ct-text-primary dark:text-white">{item.action}</Text>
                        <Text className="text-[10px] text-ct-text-faint dark:text-slate-400">· {item.result}</Text>
                      </View>
                      <Text className="text-ct-xs text-ct-text-faint dark:text-slate-400 mt-0.5" numberOfLines={2}>
                        {item.description}
                      </Text>
                      <Text className="text-[10px] text-ct-text-faint dark:text-slate-500 mt-1">
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
        <View className="mx-4 mt-1 mb-2">
          <TouchableOpacity
            onPress={handleLogout}
            className="flex-row items-center rounded-ct-xl px-4 py-3.5 border border-red-100 dark:border-red-900/30 bg-white dark:bg-ct-dark-card"
            activeOpacity={0.7}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
              elevation: 1,
            }}
          >
            <View className="w-[38px] h-[38px] rounded-ct-md bg-red-50 dark:bg-red-900/20 items-center justify-center mr-3">
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            </View>
            <View className="flex-1">
              <Text className="text-ct-sm font-extrabold text-red-600 dark:text-red-400">Sign out</Text>
              <Text className="text-ct-xs text-ct-text-faint dark:text-slate-500 mt-0.5">End your current session</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <Text className="text-center text-ct-xs text-ct-text-faint dark:text-slate-600 mt-2">
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
