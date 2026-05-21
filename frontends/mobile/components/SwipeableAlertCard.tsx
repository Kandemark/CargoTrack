import { memo, useRef } from 'react'
import { View, Text, TouchableOpacity, Animated, PanResponder } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ALERT_SEVERITY_COLORS } from '@shared/utils/statusColors'
import { useAppTheme } from '@/lib/useAppTheme'
import type { Alert as AlertType, AlertSeverity } from '@shared/api/types'

const SWIPE_THRESHOLD = -80
const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
}
const SEVERITY_ICONS: Record<AlertSeverity, React.ComponentProps<typeof Ionicons>['name']> = {
  CRITICAL: 'alert-circle', HIGH: 'warning', MEDIUM: 'information-circle', LOW: 'checkmark-circle',
}

interface Props {
  item: AlertType
  canAcknowledge: boolean
  onAcknowledge: (id: number) => void
}

function SwipeableAlertCard({ item, canAcknowledge, onAcknowledge }: Props) {
  const { colors, font, isDark } = useAppTheme()
  const c = ALERT_SEVERITY_COLORS[item.severity] ?? ALERT_SEVERITY_COLORS.LOW
  const translateX = useRef(new Animated.Value(0)).current
  const lastOffset = useRef(0)

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => canAcknowledge && !item.acknowledged && Math.abs(gs.dx) > 5,
      onPanResponderMove: (_, gs) => {
        const next = lastOffset.current + gs.dx
        translateX.setValue(Math.min(0, Math.max(next, -120)))
      },
      onPanResponderRelease: (_, gs) => {
        const finalX = lastOffset.current + gs.dx
        if (finalX < SWIPE_THRESHOLD) {
          Animated.spring(translateX, { toValue: -96, useNativeDriver: true }).start()
          lastOffset.current = -96
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
          lastOffset.current = 0
        }
      },
    }),
  ).current

  const date = new Date(item.sent_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  function snapClosed() {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
    lastOffset.current = 0
  }

  const canSwipe = canAcknowledge && !item.acknowledged

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 12, overflow: 'hidden' }}>
      {canSwipe && (
        <View style={{
          position: 'absolute',
          right: 0, top: 0, bottom: 0,
          width: 96,
          backgroundColor: '#0f2d5e',
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              snapClosed()
              onAcknowledge(item.id)
            }}
            style={{ alignItems: 'center' }}
          >
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff', marginTop: 4 }}>ACK</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View
        style={{
          transform: [{ translateX }],
          borderLeftColor: c.dot,
          borderLeftWidth: 4,
          backgroundColor: colors.card,
          borderRadius: 12,
          overflow: 'hidden',
          opacity: item.acknowledged ? 0.5 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 3,
          elevation: 2,
        }}
        {...(canSwipe ? panResponder.panHandlers : {})}
      >
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.background }}>
              <Ionicons name={SEVERITY_ICONS[item.severity]} size={11} color={c.text} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: font.size.xs, fontWeight: font.weight.bold, color: c.text }}>
                {SEVERITY_LABELS[item.severity]}
              </Text>
            </View>
            <Text style={{ fontSize: font.size.xs, color: colors.textFaint }}>{date}</Text>
          </View>

          <Text style={{
            fontSize: font.size.sm,
            fontWeight: font.weight.bold,
            color: colors.text,
            marginBottom: 4,
            fontVariant: ['tabular-nums'],
          }}>
            {item.shipment_tracking}
          </Text>
          <Text style={{
            fontSize: font.size.sm,
            color: colors.textSecondary,
            lineHeight: 19,
          }}>
            {item.message}
          </Text>

          {item.acknowledged && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
              <Ionicons name="checkmark-done" size={12} color="#6b7280" />
              <Text style={{ fontSize: font.size.xs, color: colors.textFaint }}>Acknowledged</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  )
}

export default memo(SwipeableAlertCard)
