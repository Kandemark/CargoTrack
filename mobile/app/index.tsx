import { Redirect } from 'expo-router'
import { useAuthStore, useOnboardingStore } from '@/lib/store'

/**
 * Root entry point — dispatches to:
 *   /onboarding     → first-time users who haven't seen the intro
 *   /(auth)/login   → unauthenticated returning users
 *   /(tabs)/        → authenticated users
 *
 * All three state values are resolved in _layout.tsx before this
 * component ever renders, so there's no loading flash here.
 */
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasOnboarded   = useOnboardingStore((s) => s.hasOnboarded)

  if (!hasOnboarded) return <Redirect href="/onboarding" />
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />
}
