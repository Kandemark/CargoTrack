import { Redirect } from 'expo-router'
import { useAuthStore, useOnboardingStore } from '@/lib/store'

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasOnboarded   = useOnboardingStore((s) => s.hasOnboarded)

  if (!hasOnboarded) return <Redirect href="/onboarding" />
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />
}
