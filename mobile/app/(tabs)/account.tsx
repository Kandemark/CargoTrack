/**
 * @file mobile/app/(tabs)/account.tsx
 * @description Account tab — profile header, unacknowledged alerts, and
 * settings/navigation items. Secondary screens (Payments, Documents) open
 * via router.push to their dedicated routes.
 */
import { useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { apiClient } from '@/lib/api'
import { useAuthStore, useAlertStore } from '@/lib/store'
import { ALERT_SEVERITY_COLORS } from '@shared/utils/statusColors'
import type { AlertSeverity } from '@shared/api/types'

const SEVERITY_ICON: Record<AlertSeverity, React.ComponentProps<typeof Ionicons>['name']> = {
  CRITICAL: 'alert-circle',
  HIGH:     'warning',
  MEDIUM:   'information-circle',
  LOW:      'checkmark-circle',
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={styles.sectionLabel}>{label}</Text>
  )
}

// ─── Menu item ────────────────────────────────────────────────────────────────

function MenuItem({
  icon, label, subtitle, accent = '#0f2d5e', onPress, badge,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  subtitle: string
  accent?: string
  onPress: () => void
  badge?: string
}) {
  return (
    <TouchableOpacity
      onPress={() => { Haptics.selectionAsync(); onPress() }}
      activeOpacity={0.75}
      style={styles.menuItem}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuSub}>{subtitle}</Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
    </TouchableOpacity>
  )
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({
  item, canAck, onAck,
}: {
  item: ReturnType<typeof useAlertStore.getState>['alerts'][0]
  canAck: boolean
  onAck: (id: number) => void
}) {
  const c = ALERT_SEVERITY_COLORS[item.severity] ?? ALERT_SEVERITY_COLORS.LOW
  const date = new Date(item.sent_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  return (
    <View style={[styles.alertCard, { borderLeftColor: c.dot, opacity: item.acknowledged ? 0.55 : 1 }]}>
      <View style={styles.alertTop}>
        <View style={[styles.alertBadge, { backgroundColor: c.background }]}>
          <Ionicons name={SEVERITY_ICON[item.severity]} size={11} color={c.text} />
          <Text style={[styles.alertBadgeText, { color: c.text }]}>{item.severity}</Text>
        </View>
        <Text style={styles.alertDate}>{date}</Text>
      </View>
      <Text style={styles.alertTracking}>{item.shipment_tracking}</Text>
      <Text style={styles.alertMsg}>{item.message}</Text>
      {!item.acknowledged && canAck && (
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onAck(item.id) }}
          style={styles.ackBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="checkmark-done" size={13} color="#0f2d5e" />
          <Text style={styles.ackBtnText}>Acknowledge</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const user = useAuthStore((s) => s.user)
  const { logout } = useAuthStore()
  const { alerts, isLoading, fetchAlerts, acknowledgeLocal } = useAlertStore()

  const canAck = user?.role === 'LOGISTICS_MGR' || user?.role === 'ADMIN'

  const loadAlerts = useCallback(() => { void fetchAlerts(apiClient) }, [fetchAlerts])
  useEffect(() => { loadAlerts() }, [loadAlerts])

  async function handleAcknowledge(id: number) {
    Alert.alert('Acknowledge', 'Mark this alert as acknowledged?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Acknowledge',
        onPress: async () => {
          try {
            await apiClient.post(`/api/v1/alerts/${id}/acknowledge/`)
            acknowledgeLocal(id)
          } catch {
            Alert.alert('Error', 'Could not acknowledge alert.')
          }
        },
      },
    ])
  }

  async function handleLogout() {
    Alert.alert('Sign out', 'End your current session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const unacked = alerts.filter((a) => !a.acknowledged)
  const acked   = alerts.filter((a) => a.acknowledged)
  const displayAlerts = [...unacked, ...acked].slice(0, 6)

  const initials = user
    ? (user.first_name?.[0] ?? user.username?.[0] ?? '?').toUpperCase()
    : '?'
  const displayName = user
    ? (user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user.username)
    : ''

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
      <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account</Text>
          {unacked.length > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unacked.length} new</Text>
            </View>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadAlerts} tintColor="#f5801e" />
          }
        >
          {/* ── Profile card ─────────────────────────────────────────── */}
          {user && (
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
              </View>
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>{user.role ?? 'User'}</Text>
              </View>
            </View>
          )}

          {/* ── Alerts ───────────────────────────────────────────────── */}
          <SectionLabel label={`Alerts${unacked.length > 0 ? ` · ${unacked.length} unread` : ''}`} />

          {isLoading && alerts.length === 0 ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color="#f5801e" />
          ) : displayAlerts.length === 0 ? (
            <View style={styles.emptyAlerts}>
              <View style={styles.emptyIcon}>
                <Ionicons name="checkmark-done" size={28} color="#16a34a" />
              </View>
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.emptySub}>No active alerts right now</Text>
            </View>
          ) : (
            <>
              {displayAlerts.map((a) => (
                <AlertCard key={a.id} item={a} canAck={canAck} onAck={handleAcknowledge} />
              ))}
              {(unacked.length + acked.length) > 6 && (
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/alerts')}
                  style={styles.viewAllBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewAllText}>View all {alerts.length} alerts</Text>
                  <Ionicons name="chevron-forward" size={14} color="#0f2d5e" />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ── Finance ──────────────────────────────────────────────── */}
          <SectionLabel label="Finance" />
          <MenuItem
            icon="receipt-outline"   label="Payments"
            subtitle="Invoices, M-Pesa, Airtel Money"
            onPress={() => router.push('/(tabs)/payments')}
          />
          <MenuItem
            icon="document-text-outline" label="Documents"
            subtitle="Bills of lading, customs, packing lists"
            onPress={() => router.push('/(tabs)/documents')}
          />

          {/* ── Settings ─────────────────────────────────────────────── */}
          <SectionLabel label="Settings" />
          <MenuItem
            icon="person-circle-outline" label="Profile"
            subtitle="Name, password, notification preferences"
            accent="#4f46e5"
            onPress={() => Alert.alert('Coming soon', 'Profile settings arrive in the next release.')}
          />
          <MenuItem
            icon="help-circle-outline" label="Help & Support"
            subtitle="FAQs, contact the CargoTrack team"
            accent="#0891b2"
            onPress={() => Alert.alert('Support', 'Email support@cargotrack.app')}
          />

          {/* ── Sign out ─────────────────────────────────────────────── */}
          <SectionLabel label="Session" />
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.75} style={styles.signOutRow}>
            <View style={styles.signOutIcon}>
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.signOutLabel}>Sign out</Text>
              <Text style={styles.signOutSub}>End your current session</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.footer}>CargoTrack v1.0 · East Africa Logistics Intelligence</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#0f2d5e',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  unreadBadge: {
    backgroundColor: '#f5801e', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#f5801e', alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  profileName:  { fontSize: 15, fontWeight: '700', color: '#111827' },
  profileEmail: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  rolePill: {
    backgroundColor: 'rgba(15,45,94,0.1)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  roleText: { color: '#0f2d5e', fontSize: 11, fontWeight: '700' },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#9ca3af',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginHorizontal: 20, marginBottom: 8, marginTop: 20,
  },

  alertCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, padding: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2,
  },
  alertTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  alertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  alertBadgeText: { fontSize: 10, fontWeight: '700' },
  alertDate:     { color: '#9ca3af', fontSize: 11 },
  alertTracking: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 3 },
  alertMsg:      { fontSize: 12, color: '#4b5563', lineHeight: 18 },
  ackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 10, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#0f2d5e',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  ackBtnText: { fontSize: 11, fontWeight: '700', color: '#0f2d5e' },

  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginHorizontal: 16, marginTop: 4, padding: 12,
    backgroundColor: '#fff', borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1,
  },
  viewAllText: { color: '#0f2d5e', fontSize: 13, fontWeight: '700' },

  emptyAlerts: { alignItems: 'center', paddingVertical: 24, marginHorizontal: 16 },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  emptySub:   { fontSize: 12, color: '#9ca3af', marginTop: 3 },

  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
  },
  menuIcon: {
    width: 46, height: 46, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  menuLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  menuSub:   { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  badge: {
    backgroundColor: '#f5801e', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, marginRight: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  signOutRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
  },
  signOutIcon: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: '#fee2e218',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  signOutLabel: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  signOutSub:   { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  footer: { textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 28 },
})
