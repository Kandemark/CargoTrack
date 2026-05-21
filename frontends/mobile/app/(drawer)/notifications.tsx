import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAppTheme } from '@/lib/useAppTheme'
import { T } from '@/lib/theme'
import ScreenHeader from '@/components/ScreenHeader'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Notification {
  id: number
  type: 'ALERT' | 'SHIPMENT' | 'PAYMENT' | 'SYSTEM' | 'SECURITY'
  title: string
  message: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  is_read: boolean
  related_url: string
  created_at: string
}

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  ALERT:    'warning-outline',
  SHIPMENT: 'cube-outline',
  PAYMENT:  'card-outline',
  SYSTEM:   'settings-outline',
  SECURITY: 'shield-checkmark-outline',
}

const SEVERITY_COLORS: Record<string, string> = {
  HIGH:   '#EF4444',
  MEDIUM: '#f5801e',
  LOW:    '#eab308',
  INFO:   '#3b82f6',
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { font, spacing, radius, isDark } = useAppTheme()
  const L = T.light
  const insets = useSafeAreaInsets()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiClient.get<Notification[]>('/api/v1/notifications/')
      setNotifications(res.data)
    } catch {
      // silent — screen shows empty state
    }
  }, [])

  useEffect(() => {
    fetchNotifications().finally(() => setLoading(false))
  }, [fetchNotifications])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchNotifications()
    setRefreshing(false)
  }

  async function handleMarkRead(id: number) {
    try {
      await apiClient.patch(`/api/v1/notifications/${id}/read/`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      )
    } catch {
      // silent
    }
  }

  async function handleMarkAllRead() {
    try {
      await apiClient.patch('/api/v1/notifications/mark-all-read/')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      // silent
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  function renderItem({ item }: { item: Notification }) {
    return (
      <TouchableOpacity
        onPress={() => !item.is_read && handleMarkRead(item.id)}
        activeOpacity={0.7}
        style={[styles.card, {
          backgroundColor: item.is_read ? L.surface.card : (isDark ? 'rgba(30,58,138,0.15)' : '#eff6ff'),
          borderColor: item.is_read ? L.border.light : '#bfdbfe',
        }]}
      >
        <View style={[styles.iconBox, { backgroundColor: item.is_read ? L.surface.muted : (SEVERITY_COLORS[item.severity] + '18') }]}>
          <Ionicons
            name={TYPE_ICONS[item.type] ?? 'notifications-outline'}
            size={18}
            color={item.is_read ? L.text.faint : SEVERITY_COLORS[item.severity]}
          />
        </View>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: item.is_read ? L.text.muted : L.text.primary }]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.dot} />}
          </View>
          <Text style={[styles.message, { color: item.is_read ? L.text.faint : L.text.secondary }]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={{ fontSize: font.size.xs, color: L.text.faint, marginTop: 4 }}>
            {timeAgo(item.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: L.surface.background }}>
      <ScreenHeader title="Notifications" backButton />
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + (insets.bottom || 0) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          unreadCount > 0 ? (
            <View style={styles.headerActions}>
              <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: L.text.primary }}>
                {unreadCount} unread
              </Text>
              <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
                <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: '#0f2d5e' }}>
                  Mark all read
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={L.text.faint} />
              <Text style={{ fontSize: font.size.base, fontWeight: font.weight.bold, color: L.text.muted, marginTop: 12 }}>
                No notifications
              </Text>
              <Text style={{ fontSize: font.size.sm, color: L.text.faint, marginTop: 4, textAlign: 'center' }}>
                You'll see alerts, shipment updates, and system messages here.
              </Text>
            </View>
          )
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
})
