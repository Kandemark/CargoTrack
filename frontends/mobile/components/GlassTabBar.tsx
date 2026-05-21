import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { DrawerActions, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAlertStore } from '@/lib/store'

const { width: SCREEN_W } = Dimensions.get('window')

// ── Tab icon map ──────────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; activeIcon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  index:     { icon: 'grid-outline',     activeIcon: 'grid' },
  shipments: { icon: 'cube-outline',     activeIcon: 'cube' },
  alerts:    { icon: 'notifications-outline', activeIcon: 'notifications' },
  menu:      { icon: 'menu-outline',     activeIcon: 'menu' },
}

// ── Alert badge ───────────────────────────────────────────────────────────────

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
      <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', lineHeight: 12 }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  )
}

// ── GlassTabBar ───────────────────────────────────────────────────────────────

export default function GlassTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation } = props
  const rootNav = useNavigation()
  const insets = useSafeAreaInsets()
  const unreadCount = useAlertStore((s) => s.unreadCount)

  const visibleRoutes = state.routes
  const bottomPad = insets.bottom > 0 ? insets.bottom : 6
  const barH = 56 + bottomPad
  const slotW = SCREEN_W / visibleRoutes.length

  // Per-tab scale springs
  const scales = visibleRoutes.map(() => useSharedValue(1))

  function animatePress(idx: number) {
    scales[idx].value = withSpring(0.88, { damping: 12, stiffness: 300 }, () => {
      scales[idx].value = withSpring(1, { damping: 12, stiffness: 300 })
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Blurred tab bar */}
      <View
        style={[styles.wrapper, { height: barH, paddingBottom: bottomPad }]}
        pointerEvents="box-none"
      >
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.bar, { paddingBottom: bottomPad, backgroundColor: 'rgba(10,25,41,0.85)' }]}>

          {visibleRoutes.map((route, idx) => {
            const descriptor = descriptors[route.key]
            const isFocused = state.index === idx
            const color = isFocused ? '#f5801e' : '#64748b'

            const scaleStyle = useAnimatedStyle(() => ({
              transform: [{ scale: scales[idx].value }],
            }))

            const icons = TAB_ICONS[route.name] ?? TAB_ICONS.index

            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  animatePress(idx)
                  if (route.name === 'menu') {
                    rootNav.dispatch(DrawerActions.openDrawer())
                    return
                  }
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name)
                  }
                }}
                activeOpacity={0.8}
                style={[styles.slot, { width: slotW }]}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={descriptor.options.title ?? route.name}
              >
                <Animated.View style={[styles.iconWrap, scaleStyle]}>
                  <View>
                    <Ionicons
                      name={isFocused ? icons.activeIcon : icons.icon}
                      size={24}
                      color={color}
                      style={isFocused ? { textShadowColor: 'rgba(245,128,30,0.5)', textShadowRadius: 8 } : undefined}
                    />
                    {route.name === 'alerts' ? <AlertBadge count={unreadCount} /> : null}
                  </View>
                  <Text
                    style={{ fontSize: 10, fontWeight: '700', marginTop: 2, color, letterSpacing: 0.2 }}
                  >
                    {descriptor.options.title ?? route.name}
                  </Text>
                </Animated.View>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

    </>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 0,
    overflow: 'hidden',
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
