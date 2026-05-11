import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore, useOnboardingStore } from '@/lib/store'
import { useThemeStore, useInitTheme } from '@/lib/themeStore'
import { loadFonts } from '@/lib/fonts'
import { authApi, initializeApiBaseUrl } from '@/lib/api'

void SplashScreen.preventAutoHideAsync().catch(() => null)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
})

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const resolved = useThemeStore((s) => s.resolved)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      {ready ? children : null}
    </View>
  )
}

export default function RootLayout() {
  const { loadStoredTokens, setUser, logout } = useAuthStore()
  const { checkOnboarded } = useOnboardingStore()
  const [isReady, setIsReady] = useState(false)

  useInitTheme()

  useEffect(() => {
    let isMounted = true

    async function init() {
      const [, hasTokenResult] = await Promise.allSettled([
        Promise.all([loadFonts(), initializeApiBaseUrl(), checkOnboarded()]),
        loadStoredTokens(),
      ])

      const hasToken =
        hasTokenResult.status === 'fulfilled' ? hasTokenResult.value : false

      if (hasToken) {
        try {
          const res = await Promise.race<{ data: Parameters<typeof setUser>[0] }>([
            authApi.me(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('profile timeout')), 2000),
            ),
          ])
          setUser(res.data)
        } catch {
          await logout()
        }
      }

      if (isMounted) setIsReady(true)
    }

    init().catch(() => {
      if (isMounted) setIsReady(true)
    })

    return () => {
      isMounted = false
    }
  }, [checkOnboarded, loadStoredTokens, logout, setUser])

  useEffect(() => {
    if (!isReady) return
    void SplashScreen.hideAsync().catch(() => null)
  }, [isReady])

  if (!isReady) return null

  return (
    <ThemeWrapper>
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
    </ThemeWrapper>
  )
}
