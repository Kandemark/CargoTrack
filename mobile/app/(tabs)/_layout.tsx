/**
 * @file mobile/app/(tabs)/_layout.tsx
 * @description 3-zone bottom tab navigator.
 *
 * Zones:
 *   Home    — dashboard, KPIs, recent activity
 *   Track   — full-screen MapLibre map + shipment list sheet
 *   Account — profile, alerts, payments, documents, settings
 *
 * Secondary screens (payments, documents, alerts) are navigated from
 * within the Account tab via router.push — not given tab bar slots.
 */
import { useEffect } from 'react'
import { View, Text, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAlertStore } from '@/lib/store'
import { apiClient } from '@/lib/api'

// ── Icon helpers ──────────────────────────────────────────────────────────────

function TabIcon({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>['name']
  color: string
  focused: boolean
}) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as any)}
      size={24}
      color={color}
    />
  )
}

function AccountIcon({ color, focused }: { color: string; focused: boolean }) {
  const unread = useAlertStore((s) => s.unreadCount)
  return (
    <View>
      <Ionicons
        name={focused ? 'person-circle' : 'person-circle-outline'}
        size={24}
        color={color}
      />
      {unread > 0 && (
        <View
          style={{
            position: 'absolute', top: -4, right: -7,
            minWidth: 17, height: 17, borderRadius: 9,
            backgroundColor: '#f5801e',
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 3,
            borderWidth: 1.5, borderColor: '#0f2d5e',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 11 }}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </View>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const fetchAlerts = useAlertStore((s) => s.fetchAlerts)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    fetchAlerts(apiClient)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const bottomPad  = insets.bottom > 0 ? insets.bottom : Platform.OS === 'android' ? 6 : 10
  const tabBarHeight = 56 + bottomPad

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f2d5e',
          borderTopColor: '#1a3a6b',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#f5801e',
        tabBarInactiveTintColor: '#6b93bb',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      {/* ── Zone 1: Home (Dashboard) ────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="speedometer" color={color} focused={focused} />
          ),
        }}
      />

      {/* ── Zone 2: Track (Live Map + Shipments) ────────────────────── */}
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="navigate" color={color} focused={focused} />
          ),
        }}
      />

      {/* ── Zone 3: Account (Profile + Alerts + Settings) ───────────── */}
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <AccountIcon color={color} focused={focused} />
          ),
        }}
      />

      {/* ── Hidden routes (navigated from Account tab) ──────────────── */}
      <Tabs.Screen name="payments"  options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="alerts"    options={{ href: null }} />
      <Tabs.Screen name="map"       options={{ href: null }} />
      <Tabs.Screen name="shipments" options={{ href: null }} />
      <Tabs.Screen name="more"      options={{ href: null }} />
    </Tabs>
  )
}
