
import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { useAppTheme } from '@/lib/useAppTheme'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { DrawerActions, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAlertStore } from '@/lib/store'

const { width: SCREEN_W } = Dimensions.get('window')

const TAB_ICONS: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; activeIcon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  index:     { icon: 'grid-outline',     activeIcon: 'grid' },
  shipments: { icon: 'cube-outline',     activeIcon: 'cube' },
  alerts:    { icon: 'notifications-outline', activeIcon: 'notifications' },
  menu:      { icon: 'menu-outline',     activeIcon: 'menu' },
}

function AlertBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <View style={{
      position: 'absolute',
      top: -6,
      right: -16,
      minWidth: 18,
      height: 18,
      borderRadius: 9999,
      backgroundColor: '#f5801e',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    }}>
      <Text style={{ fontSize: 9, fontFamily: 'DMSans-Bold', color: '#fff', lineHeight: 12 }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  )
}

function TabButton({
  route,
  descriptor,
  isFocused,
  width: slotW,
  alertCount,
  onPress,
}: {
  route: BottomTabBarProps['state']['routes'][number]
  descriptor: BottomTabBarProps['descriptors'][string]
  isFocused: boolean
  width: number
  alertCount: number
  onPress: () => void
}) {
  const { colors } = useAppTheme()
  const scale = useSharedValue(1)
  const rootNav = useNavigation()

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    scale.value = withSpring(0.9, { damping: 14, stiffness: 320 }, () => {
      scale.value = withSpring(1, { damping: 14, stiffness: 320 })
    })
    if (route.name === 'menu') {
      rootNav.dispatch(DrawerActions.openDrawer())
      return
    }
    onPress()
  }

  const color = isFocused ? '#f5801e' : colors.textMuted
  const icons = TAB_ICONS[route.name] ?? TAB_ICONS.index

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[styles.slot, { width: slotW }]}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={descriptor.options.title ?? route.name}
    >
      <Animated.View style={[styles.iconWrap, scaleStyle]}>
        <View>
          <Ionicons name={isFocused ? icons.activeIcon : icons.icon} size={22} color={color} />
          {route.name === 'alerts' ? <AlertBadge count={alertCount} /> : null}
        </View>
        <Text style={{ fontSize: 11, fontFamily: isFocused ? 'DMSans-Bold' : 'DMSans-Medium', marginTop: 3, color }}>
          {descriptor.options.title ?? route.name}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

/** Gap between the floating bar and the screen edges. */
const SIDE = 16

/**
 * A floating bar: lifted off the screen edges with fully rounded ends and
 * a soft shadow. A tinted pill glides to the selected tab.
 */
export default function GlassTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation } = props
  const insets = useSafeAreaInsets()
  const { colors, isDark } = useAppTheme()
  const alertCount = useAlertStore((s) => s.unreadCount)

  const routes = state.routes
  const barW = SCREEN_W - SIDE * 2
  const slotW = barW / routes.length
  const indicatorX = useSharedValue(state.index * slotW)

  useEffect(() => {
    indicatorX.value = withSpring(state.index * slotW, { damping: 18, stiffness: 180 })
  }, [state.index, slotW, indicatorX])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }))

  function makeOnPress(idx: number) {
    return () => {
      const route = routes[idx]
      if (route.name === 'menu') return
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
      if (state.index !== idx && !event.defaultPrevented) {
        navigation.navigate(route.name)
      }
    }
  }

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: SIDE, right: SIDE, bottom: Math.max(insets.bottom, 8) + 8 }}>
      <View
        style={{
          height: 64,
          borderRadius: 32,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? '#1E2A40' : colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,45,94,0.08)',
          shadowColor: '#0f2d5e',
          shadowOpacity: isDark ? 0.5 : 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 6,
              width: slotW - 12,
              height: 52,
              borderRadius: 26,
              backgroundColor: 'rgba(245,128,30,0.14)',
            },
            indicatorStyle,
          ]}
        />
        {routes.map((route, idx) => (
          <TabButton
            key={route.key}
            route={route}
            descriptor={descriptors[route.key]}
            isFocused={state.index === idx}
            width={slotW}
            alertCount={alertCount}
            onPress={makeOnPress(idx)}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  slot: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
