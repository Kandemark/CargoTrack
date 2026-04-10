/**
 * @file mobile/app/(tabs)/alerts.tsx
 * @description Alerts tab — displays unacknowledged delay alerts and allows
 * managers to acknowledge them with a swipe or tap action.
 *
 * Data flow:
 *   - Reads `alerts`, `unreadCount`, and `isLoading` from `useAlertStore`.
 *   - `fetchAlerts(apiClient)` is called on mount and on pull-to-refresh,
 *     passing the Axios instance explicitly (store is decoupled from singleton).
 *   - Acknowledge action calls `POST /api/v1/alerts/<id>/acknowledge/` and
 *     then calls `acknowledgeLocal(id)` to update the badge count in-place.
 *
 * Platform notes:
 *   - The unread count badge is rendered via a red dot using React Native's
 *     `View` styled with `borderRadius`; no native badge API is used.
 *
 * @route /(tabs)/alerts
 * @auth IsAuthenticated (read); IsManagerUser (acknowledge)
 */
import { useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  PanResponder,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api'
import { useAuthStore, useAlertStore } from '@/lib/store'
import { ALERT_SEVERITY_COLORS } from '@shared/utils/statusColors'
import type { Alert as AlertType, AlertSeverity } from '@shared/api/types'

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  CRITICAL: 'Critical',
  HIGH:     'High',
  MEDIUM:   'Medium',
  LOW:      'Low',
}

const SEVERITY_ICONS: Record<AlertSeverity, React.ComponentProps<typeof Ionicons>['name']> = {
  CRITICAL: 'alert-circle',
  HIGH:     'warning',
  MEDIUM:   'information-circle',
  LOW:      'checkmark-circle',
}

const SWIPE_THRESHOLD = -80

// ─── Swipeable alert card (swipe left to acknowledge) ─────────────────────────

function SwipeableAlertCard({
  item,
  canAcknowledge,
  onAcknowledge,
}: {
  item: AlertType
  canAcknowledge: boolean
  onAcknowledge: (id: number) => void
}) {
  const c   = ALERT_SEVERITY_COLORS[item.severity] ?? ALERT_SEVERITY_COLORS.LOW
  const translateX = useRef(new Animated.Value(0)).current
  const lastOffset = useRef(0)

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        canAcknowledge && !item.acknowledged && Math.abs(gestureState.dx) > 5,
      onPanResponderMove: (_, gestureState) => {
        const next = lastOffset.current + gestureState.dx
        translateX.setValue(Math.min(0, Math.max(next, -120)))
      },
      onPanResponderRelease: (_, gestureState) => {
        const finalX = lastOffset.current + gestureState.dx
        if (finalX < SWIPE_THRESHOLD) {
          // Snap open to reveal action button
          Animated.spring(translateX, {
            toValue: -96,
            useNativeDriver: true,
          }).start()
          lastOffset.current = -96
        } else {
          // Snap closed
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start()
          lastOffset.current = 0
        }
      },
    }),
  ).current

  const date = new Date(item.sent_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  function snapClosed() {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
    lastOffset.current = 0
  }

  return (
    <View className="mx-4 mb-3" style={{ overflow: 'hidden' }}>
      {/* Acknowledge action revealed behind the card */}
      {canAcknowledge && !item.acknowledged && (
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 96,
            backgroundColor: '#0f2d5e',
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TouchableOpacity
            onPress={() => { snapClosed(); onAcknowledge(item.id) }}
            style={{ alignItems: 'center' }}
          >
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 3 }}>
              ACK
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Card */}
      <Animated.View
        style={{
          transform: [{ translateX }],
          backgroundColor: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          borderLeftWidth: 4,
          borderLeftColor: c.dot,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 3,
          elevation: 2,
        }}
        {...(canAcknowledge && !item.acknowledged ? panResponder.panHandlers : {})}
      >
        <View style={{ padding: 16, opacity: item.acknowledged ? 0.5 : 1 }}>
          {/* Top row: badge + date */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: c.background,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Ionicons name={SEVERITY_ICONS[item.severity]} size={11} color={c.text} />
              <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>
                {SEVERITY_LABELS[item.severity]}
              </Text>
            </View>
            <Text style={{ color: '#9ca3af', fontSize: 11 }}>{date}</Text>
          </View>

          {/* Tracking number */}
          <Text style={{ color: '#111827', fontSize: 13, fontWeight: '700', marginBottom: 4, fontVariant: ['tabular-nums'] }}>
            {item.shipment_tracking}
          </Text>

          {/* Message */}
          <Text style={{ color: '#4b5563', fontSize: 13, lineHeight: 19 }}>
            {item.message}
          </Text>

          {/* Acknowledged indicator */}
          {item.acknowledged && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
              <Ionicons name="checkmark-done" size={12} color="#6b7280" />
              <Text style={{ color: '#9ca3af', fontSize: 11 }}>Acknowledged</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const user              = useAuthStore((s) => s.user)
  const { alerts, isLoading, fetchAlerts, acknowledgeLocal } = useAlertStore()

  const canAcknowledge = user?.role === 'LOGISTICS_MGR' || user?.role === 'ADMIN'

  const load = useCallback(
    (isRefresh = false) => {
      void fetchAlerts(apiClient)
    },
    [fetchAlerts],
  )

  useEffect(() => { load() }, [load])

  async function handleAcknowledge(id: number) {
    Alert.alert('Acknowledge Alert', 'Mark this alert as acknowledged?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Acknowledge',
        onPress: async () => {
          try {
            await apiClient.post(`/api/v1/alerts/${id}/acknowledge/`)
            acknowledgeLocal(id)
          } catch {
            Alert.alert('Error', 'Could not acknowledge this alert.')
          }
        },
      },
    ])
  }

  const unacked = alerts.filter((a) => !a.acknowledged)
  const acked   = alerts.filter((a) => a.acknowledged)
  const allSorted = [...unacked, ...acked]

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0f2d5e' }}>
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <View className="bg-ct-navy px-5 pt-4 pb-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-xl font-bold">Alerts</Text>
          {unacked.length > 0 && (
            <View className="bg-ct-orange rounded-full px-2.5 py-0.5">
              <Text className="text-white text-xs font-bold">{unacked.length}</Text>
            </View>
          )}
        </View>
        <Text className="text-blue-300 text-xs mt-1">
          {unacked.length} unacknowledged · {acked.length} resolved
          {canAcknowledge && unacked.length > 0 && ' · swipe left to acknowledge'}
        </Text>
      </View>

      {isLoading && alerts.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f5801e" />
        </View>
      ) : (
        <FlatList
          data={allSorted}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <SwipeableAlertCard
              item={item}
              canAcknowledge={canAcknowledge}
              onAcknowledge={handleAcknowledge}
            />
          )}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => load(true)}
              tintColor="#f5801e"
            />
          }
          ListHeaderComponent={
            unacked.length > 0 ? (
              <Text className="px-5 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Requires attention
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="checkmark-circle-outline" size={44} color="#86efac" />
              <Text className="text-gray-500 font-semibold mt-3">All clear</Text>
              <Text className="text-gray-400 text-sm mt-1">No active alerts</Text>
            </View>
          }
        />
      )}
    </View>
    </SafeAreaView>
  )
}
