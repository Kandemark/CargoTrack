/**
 * mobile/lib/api.ts
 *
 * Creates the Axios client for the mobile app, configured with:
 *  - JWT access token injected from SecureStore on every request
 *  - Automatic token refresh via POST /api/auth/token/refresh/
 *  - 401 + refresh failure → clear SecureStore and navigate to login
 *
 * All API modules are bound to this single client instance.
 */
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import { Platform } from 'react-native'

import { createApiClient } from '@shared/api/client'
import { createAuthApi } from '@shared/api/auth'
import { createShipmentsApi } from '@shared/api/shipments'
import { createDashboardApi } from '@shared/api/dashboard'

/**
 * Resolves the backend base URL in priority order:
 * 1. EXPO_PUBLIC_API_URL env var
 * 2. Constants.expoConfig.hostUri (Expo Go / Metro dev server)
 * 3. Platform-appropriate fallback
 */
function getApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL

  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) {
    const host = hostUri.split(':')[0]
    if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
      return 'http://10.0.2.2:8000'
    }
    return `http://${host}:8000`
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000'
}

const BASE_URL = getApiUrl()

async function handleUnauthorized() {
  await SecureStore.deleteItemAsync('access_token')
  await SecureStore.deleteItemAsync('refresh_token')
  // Also clear Zustand store — import lazily to avoid circular dependency
  const { useAuthStore } = await import('./store')
  useAuthStore.getState().logout()
  router.replace('/(auth)/login')
}

export const apiClient = createApiClient({
  baseURL: BASE_URL,
  getAccessToken: () => SecureStore.getItemAsync('access_token'),
  getRefreshToken: () => SecureStore.getItemAsync('refresh_token'),
  saveAccessToken: (token) => SecureStore.setItemAsync('access_token', token),
  onUnauthorized: () => void handleUnauthorized(),
  refreshEndpoint: '/api/auth/token/refresh/',
})

export const authApi      = createAuthApi(apiClient)
export const shipmentsApi = createShipmentsApi(apiClient)
export const dashboardApi = createDashboardApi(apiClient)
