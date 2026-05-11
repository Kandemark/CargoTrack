import { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/lib/useAppTheme'
import { T } from '@/lib/theme'

export type ToastType = 'error' | 'success' | 'info' | 'warning'

interface ToastProps {
  type?: ToastType
  message: string
  visible: boolean
  onDismiss: () => void
  duration?: number
}

const config: Record<ToastType, { textColor: string; iconColor: string; icon: keyof typeof Ionicons.glyphMap }> = {
  error:   { textColor: '#991b1b', iconColor: '#EF4444', icon: 'alert-circle' },
  success: { textColor: '#065f46', iconColor: '#10B981', icon: 'checkmark-circle' },
  info:    { textColor: '#1e40af', iconColor: '#3B82F6', icon: 'information-circle' },
  warning: { textColor: '#92400e', iconColor: '#F59E0B', icon: 'warning' },
}

export default function Toast({
  type = 'error',
  message,
  visible,
  onDismiss,
  duration = 4000,
}: ToastProps) {
  const { colors, isDark } = useAppTheme()
  const translateY = useSharedValue(-100)
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 })
      opacity.value = withTiming(1, { duration: 200 })
      const t = setTimeout(() => onDismiss(), duration)
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

  const bgMap: Record<ToastType, string> = {
    error: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
    success: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5',
    info: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
    warning: isDark ? 'rgba(245,158,11,0.15)' : '#FFFBEB',
  }

  const borderMap: Record<ToastType, string> = {
    error: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
    success: isDark ? 'rgba(16,185,129,0.3)' : '#A7F3D0',
    info: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
    warning: isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A',
  }

  return (
    <Animated.View style={[animatedStyle, {
      position: 'absolute',
      top: 56,
      left: 16,
      right: 16,
      zIndex: 50,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: T.radius.lg,
      borderWidth: 1,
      backgroundColor: bgMap[type],
      borderColor: borderMap[type],
    }]}>
      <Ionicons name={c.icon} size={20} color={c.iconColor} />
      <Text style={{
        flex: 1,
        marginLeft: 8,
        fontSize: T.font.size.sm,
        fontWeight: T.font.weight.bold,
        color: c.textColor,
      }} numberOfLines={2}>
        {message}
      </Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color={c.iconColor} />
      </TouchableOpacity>
    </Animated.View>
  )
}
