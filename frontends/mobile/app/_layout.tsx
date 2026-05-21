import { Component, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore, useOnboardingStore } from '@/lib/store'
import { useThemeStore, useInitTheme } from '@/lib/themeStore'
import { loadFonts } from '@/lib/fonts'
import { authApi, apiClient, initializeApiBaseUrl } from '@/lib/api'
import { resolveDefaultApiBaseUrl } from '@/lib/runtime-config'
import SecurityProvider from '@/components/SecurityProvider'

void SplashScreen.preventAutoHideAsync().catch(() => null)

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout: ${label}`)), ms),
    ),
  ])
}

// ── Error Boundary ────────────────────────────────────────────────────────────

interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  handleReset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0f2d5e', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
            {__DEV__ ? this.state.error?.message : 'An unexpected error occurred. Please restart the app.'}
          </Text>
          <TouchableOpacity
            onPress={this.handleReset}
            style={{ backgroundColor: '#f5801e', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

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
      // Fast path: set base URL instantly from Metro host (no network calls)
      apiClient.defaults.baseURL = resolveDefaultApiBaseUrl()

      const [onboardResult, hasTokenResult] = await Promise.allSettled([
        Promise.all([
          withTimeout(loadFonts(), 3000, 'loadFonts'),
          withTimeout(checkOnboarded(), 2000, 'checkOnboarded'),
        ]),
        withTimeout(loadStoredTokens(), 2000, 'loadStoredTokens'),
      ])

      if (onboardResult.status === 'rejected') {
        if (__DEV__) console.warn('[init] checkOnboarded failed:', onboardResult.reason)
      }

      const hasToken =
        hasTokenResult.status === 'fulfilled' ? hasTokenResult.value : false

      if (hasToken) {
        try {
          const res = await Promise.race<{ data: Parameters<typeof setUser>[0] }>([
            authApi.me(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('profile timeout')), 1500),
            ),
          ])
          setUser(res.data)
        } catch {
          await withTimeout(logout(), 2000, 'logout')
        }
      }

      if (isMounted) setIsReady(true)
    }

    // Global safety timeout: unhide splash after 6 s no matter what
    const globalTimer = setTimeout(() => {
      if (isMounted) setIsReady(true)
    }, 6000)

    init().catch(() => {
      if (isMounted) setIsReady(true)
    }).finally(() => clearTimeout(globalTimer))

    return () => {
      isMounted = false
    }
  }, [checkOnboarded, loadStoredTokens, logout, setUser])

  useEffect(() => {
    if (!isReady) return
    void SplashScreen.hideAsync().catch(() => null)

    // Background: run full API discovery to find a better URL if available
    initializeApiBaseUrl().catch(() => {})
  }, [isReady])

  if (!isReady) return null

  return (
    <ErrorBoundary>
      <ThemeWrapper>
        <QueryClientProvider client={queryClient}>
          <SecurityProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(drawer)" />
            </Stack>
          </SecurityProvider>
        </QueryClientProvider>
      </ThemeWrapper>
    </ErrorBoundary>
  )
}
