/**
 * @file mobile/app/_layout.tsx
 * @description Root Expo Router layout — initialises auth state from
 * SecureStore before the splash screen is hidden, then renders the
 * Stack navigator with all top-level route segments.
 *
 * Startup sequence:
 *   1. `SplashScreen.preventAutoHideAsync()` keeps the splash visible.
 *   2. `loadStoredTokens()` reads the access_token from SecureStore.
 *   3. `SplashScreen.hideAsync()` is called in the `finally` block so
 *      the splash disappears whether auth succeeds or fails.
 *
 * Segments:
 *   (auth)          — Login screen (unauthenticated)
 *   (tabs)          — Bottom tab navigator (authenticated)
 *   shipment/[id]   — Shipment detail screen
 *   shipment/log-event — Log tracking event form
 */
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
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="shipment/log-event"
        options={{ headerShown: false }}
      />
    </Stack>
  )
}
