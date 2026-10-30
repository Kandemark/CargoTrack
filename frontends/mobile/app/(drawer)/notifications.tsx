import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { apiClient } from '@/lib/api'
import { useBack } from '@/lib/useBack'
import { useAppTheme } from '@/lib/useAppTheme'
import { listOf } from '@/lib/data'
import { timeAgo } from '@shared/utils/formatters'
import { Empty, Loading, ScreenFrame, Section, Txt } from '@/components/ui'

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

const ICON: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  ALERT: 'warning-outline',
  SHIPMENT: 'cube-outline',
  PAYMENT: 'card-outline',
  SYSTEM: 'information-circle-outline',
  SECURITY: 'shield-checkmark-outline',
}

/**
 * Updates about payments, deliveries, bids and the account. Unread ones
 * carry a dot; opening one marks it read. Shipment risk lives in Alerts.
 */
export default function NotificationsScreen() {
  const back = useBack()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/notifications/')
      setItems(listOf<Notification>(res.data))
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  async function open(n: Notification) {
    if (!n.is_read) {
      setItems((all) => all.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      apiClient.patch(`/api/v1/notifications/${n.id}/read/`).catch(() => {})
    }
    if (n.related_url?.startsWith('/')) router.push(n.related_url as any)
  }

  async function readAll() {
    setItems((all) => all.map((x) => ({ ...x, is_read: true })))
    apiClient.patch('/api/v1/notifications/mark-all-read/').catch(() => {})
  }

  const unread = items.filter((n) => !n.is_read).length

  return (
    <ScreenFrame
      title="Notifications"
      subtitle={unread ? `${unread} unread` : 'All read'}
      onBack={back}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }}>
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty icon="megaphone-outline" title="Nothing new" body="Payments, deliveries and bids will show up here." />
      ) : (
        <Section label="Latest" action={unread ? 'Mark all read' : undefined} onAction={readAll}>
          {items.map((n, i) => (
            <Row key={n.id} n={n} last={i === items.length - 1} onPress={() => open(n)} />
          ))}
        </Section>
      )}
    </ScreenFrame>
  )
}

function Row({ n, last, onPress }: { n: Notification; last: boolean; onPress: () => void }) {
  const { colors, brand, isDark } = useAppTheme()
  const tint = isDark ? colors.textBrand : brand.primary
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 14,
        paddingVertical: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderMid,
        opacity: pressed ? 0.6 : 1,
      })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: `${tint}1A` }}>
        <Ionicons name={ICON[n.type] ?? 'notifications-outline'} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt variant={n.is_read ? 'body' : 'bodyStrong'} style={{ flex: 1 }} numberOfLines={2}>{n.title}</Txt>
          <Txt variant="caption" tone="faint">{timeAgo(n.created_at)}</Txt>
        </View>
        <Txt variant="caption" tone="muted" numberOfLines={3} style={{ marginTop: 2 }}>{n.message.split('\n')[0]}</Txt>
      </View>
      {!n.is_read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: brand.accent, marginTop: 8 }} /> : null}
    </Pressable>
  )
}
