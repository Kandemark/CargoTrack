import { memo, useRef } from 'react'
import { View, Text, TouchableOpacity, Animated, PanResponder } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ALERT_SEVERITY_COLORS } from '@shared/utils/statusColors'
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
    <View className="mx-4 mb-ct-md overflow-hidden">
      {canSwipe && (
        <View className="absolute right-0 top-0 bottom-0 w-24 bg-ct-navy rounded-ct-lg items-center justify-center">
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); snapClosed(); onAcknowledge(item.id) }} className="items-center">
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text className="text-[10px] font-bold text-white mt-1">ACK</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View
        style={{
          transform: [{ translateX }],
          borderLeftColor: c.dot,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 3,
          elevation: 2,
        }}
        className={`bg-ct-surface-card dark:bg-ct-dark-card rounded-ct-lg overflow-hidden border-l-4 ${
          item.acknowledged ? 'opacity-50' : 'opacity-100'
        }`}
        {...(canSwipe ? panResponder.panHandlers : {})}
      >
        <View className="p-ct-lg">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center rounded-ct-sm px-2 py-0.5" style={{ backgroundColor: c.background }}>
              <Ionicons name={SEVERITY_ICONS[item.severity]} size={11} color={c.text} style={{ marginRight: 4 }} />
              <Text className="text-ct-xs font-bold" style={{ color: c.text }}>{SEVERITY_LABELS[item.severity]}</Text>
            </View>
            <Text className="text-ct-xs text-ct-text-faint">{date}</Text>
          </View>

          <Text className="text-ct-sm font-bold text-ct-text-primary dark:text-ct-dark-text mb-1 tabular-nums">
            {item.shipment_tracking}
          </Text>
          <Text className="text-ct-sm text-ct-text-secondary dark:text-ct-dark-text-muted leading-[19px]">
            {item.message}
          </Text>

          {item.acknowledged && (
            <View className="flex-row items-center mt-2 gap-1">
              <Ionicons name="checkmark-done" size={12} color="#6b7280" />
              <Text className="text-ct-xs text-ct-text-faint">Acknowledged</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  )
}

export default memo(SwipeableAlertCard)
