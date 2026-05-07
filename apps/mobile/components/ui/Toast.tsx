import { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { cn } from '@/lib/utils'

export type ToastType = 'error' | 'success' | 'info' | 'warning'

interface ToastProps {
  type?: ToastType
  message: string
  visible: boolean
  onDismiss: () => void
  duration?: number
}

const config = {
  error:   { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-800 dark:text-red-200', icon: 'alert-circle' as const, iconColor: '#EF4444' },
  success: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-800 dark:text-emerald-200', icon: 'checkmark-circle' as const, iconColor: '#10B981' },
  info:    { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-200', icon: 'information-circle' as const, iconColor: '#3B82F6' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-200', icon: 'warning' as const, iconColor: '#F59E0B' },
}

export default function Toast({
  type = 'error',
  message,
  visible,
  onDismiss,
  duration = 4000,
}: ToastProps) {
  const translateY = useSharedValue(-100)
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 })
      opacity.value = withTiming(1, { duration: 200 })
      const t = setTimeout(() => {
        onDismiss()
      }, duration)
      return () => clearTimeout(t)
    } else {
      translateY.value = withTiming(-100, { duration: 200 })
      opacity.value = withTiming(0, { duration: 200 })
    }
  }, [visible, duration, onDismiss, translateY, opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  if (!visible) return null

  const c = config[type]

  return (
    <Animated.View
      style={animatedStyle}
      className={cn(
        'absolute top-14 left-4 right-4 z-50 flex-row items-center px-ct-lg py-ct-md rounded-ct-lg border',
        c.bg,
        c.border,
      )}
    >
      <Ionicons name={c.icon} size={20} color={c.iconColor} />
      <Text className={cn('flex-1 ml-ct-sm text-ct-sm font-bold', c.text)} numberOfLines={2}>
        {message}
      </Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color={c.iconColor} />
      </TouchableOpacity>
    </Animated.View>
  )
}
