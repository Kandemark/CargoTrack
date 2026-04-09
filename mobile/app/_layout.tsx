import '../global.css'

import { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useAuthStore } from '@/lib/store'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { loadStoredTokens, isAuthenticated } = useAuthStore()

  useEffect(() => {
    loadStoredTokens().finally(() => SplashScreen.hideAsync())
  }, [])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="shipment/[id]"
        options={{
          headerShown: true,
          headerTitle: 'Shipment Detail',
          headerStyle: { backgroundColor: '#0f2d5e' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '700' },
          presentation: 'card',
        }}
      />
    </Stack>
  )
}
