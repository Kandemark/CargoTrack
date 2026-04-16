/**
 * @file mobile/app/_layout.tsx
 * @description Root Expo Router layout — init sequence:
 *   1. Keep splash visible (preventAutoHideAsync)
 *   2. Check onboarding flag from AsyncStorage
 *   3. Load stored auth tokens from SecureStore
 *   4. If authenticated, restore user profile via /api/auth/me
 *   5. Set isReady, hide splash → index.tsx redirects based on state
 *
 * Wraps the entire app in QueryClientProvider for React Query caching.
 */
import '../global.css'

import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/store'
import { useOnboardingStore } from '@/lib/store'
import { authApi } from '@/lib/api'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
})

export default function RootLayout() {
  const { loadStoredTokens, setUser, logout } = useAuthStore()
  const { checkOnboarded } = useOnboardingStore()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    async function init() {
      // Check onboarding and auth in parallel
      const [hasToken] = await Promise.all([
        loadStoredTokens(),
        checkOnboarded(),
      ])

      if (hasToken) {
        // Restore user profile. On failure (expired token), logout clears
        // state so index.tsx redirects naturally to login.
        try {
          const res = await authApi.me()
          setUser(res.data)
        } catch {
          await logout()
        }
      }
    }

    init().finally(() => {
      setIsReady(true)
      SplashScreen.hideAsync()
    })
  }, [])

  if (!isReady) return null

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="shipment/[id]" />
        <Stack.Screen name="shipment/log-event" />
      </Stack>
    </QueryClientProvider>
  )
}
