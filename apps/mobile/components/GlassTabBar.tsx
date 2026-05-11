import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAlertStore } from '@/lib/store'
import FabActionsSheet from './FabActionsSheet'

const { width: SCREEN_W } = Dimensions.get('window')

// ── Tab icon map ──────────────────────────────────────────────────────────────

const TAB_ICONS: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; activeIcon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  index:     { icon: 'grid-outline',     activeIcon: 'grid' },
  shipments: { icon: 'cube-outline',     activeIcon: 'cube' },
  track:     { icon: 'map-outline',      activeIcon: 'map' },
  alerts:    { icon: 'notifications-outline', activeIcon: 'notifications' },
  account:   { icon: 'person-circle-outline', activeIcon: 'person-circle' },
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

const VISIBLE_TABS = new Set(['index', 'shipments', 'track', 'alerts', 'account'])

export default function GlassTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation } = props
  const insets = useSafeAreaInsets()
  const unreadCount = useAlertStore((s) => s.unreadCount)
  const [fabOpen, setFabOpen] = useState(false)

  const visibleRoutes = state.routes.filter((r) => VISIBLE_TABS.has(r.name))
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
            const isTrack = route.name === 'track'
            const descriptor = descriptors[route.key]
            const isFocused = state.index === idx
            const color = isFocused ? '#f5801e' : '#64748b'

            const scaleStyle = useAnimatedStyle(() => ({
              transform: [{ scale: scales[idx].value }],
            }))

            // FAB slot — render the orange FAB instead of a tab button
            if (isTrack) {
              return (
                <View key={route.key} style={[styles.slot, { width: slotW }]}>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setFabOpen(true)
                    }}
                    activeOpacity={0.85}
                    style={[styles.fab, {
                      shadowColor: '#f5801e',
                      shadowOpacity: 0.45,
                      shadowRadius: 12,
                      elevation: 8,
                      backgroundColor: '#f5801e',
                    }]}
                  >
                    <Ionicons name="add" size={30} color="#fff" />
                  </TouchableOpacity>
                </View>
              )
            }

            const icons = TAB_ICONS[route.name] ?? TAB_ICONS.index

            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  animatePress(idx)
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

      <FabActionsSheet visible={fabOpen} onClose={() => setFabOpen(false)} />
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
  fab: {
    width: 52,
    height: 52,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
  },
})
