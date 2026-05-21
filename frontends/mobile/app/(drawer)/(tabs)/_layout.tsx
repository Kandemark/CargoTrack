import { useEffect } from 'react'
import { View } from 'react-native'
import { Tabs } from 'expo-router'
import { useAlertStore } from '@/lib/store'
import { apiClient } from '@/lib/api'
import { useThemeStore } from '@/lib/themeStore'
import GlassTabBar from '@/components/GlassTabBar'

// All roles use the same 4-tab layout. Role-specific features live in the drawer.
export default function TabLayout() {
  const fetchAlerts = useAlertStore((s) => s.fetchAlerts)
  const resolved = useThemeStore((s) => s.resolved)
  const isDark = resolved === 'dark'

  useEffect(() => {
    fetchAlerts(apiClient)
  }, [fetchAlerts])

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0a1929' : '#F1F5F9' }}>
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: isDark ? '#0a1929' : '#F1F5F9' },
        }}
      >
        <Tabs.Screen name="index"      options={{ title: 'Home' }} />
        <Tabs.Screen name="shipments"  options={{ title: 'Shipments' }} />
        <Tabs.Screen name="alerts"     options={{ title: 'Alerts' }} />
        <Tabs.Screen name="menu"       options={{ title: 'Menu' }} />
      </Tabs>
    </View>
  )
}
