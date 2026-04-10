/**
 * mobile/lib/api.ts
 *
 * Creates the Axios client for the mobile app, configured with:
 *  - JWT access token injected from SecureStore on every request
 *  - Automatic 401 → navigate to login
 *
 * All API modules are bound to this single client instance.
 */
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'

import { createApiClient } from '@shared/api/client'
import { createAuthApi } from '@shared/api/auth'
import { createShipmentsApi } from '@shared/api/shipments'
import { createDashboardApi } from '@shared/api/dashboard'

// Default to Android emulator localhost; override with EXPO_PUBLIC_API_URL in .env
if (!process.env.EXPO_PUBLIC_API_URL) {
  console.warn(
    '[CargoTrack] EXPO_PUBLIC_API_URL is not set. ' +
    'Falling back to Android emulator address (http://10.0.2.2:8000). ' +
    'Set EXPO_PUBLIC_API_URL in mobile/.env for physical devices or iOS.',
  )
}
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000'

export const apiClient = createApiClient({
  baseURL: BASE_URL,
  getAccessToken: () => SecureStore.getItemAsync('access_token'),
  onUnauthorized: () => {
    SecureStore.deleteItemAsync('access_token')
    SecureStore.deleteItemAsync('refresh_token')
    router.replace('/(auth)/login')
  },
})

export const authApi      = createAuthApi(apiClient)
export const shipmentsApi = createShipmentsApi(apiClient)
export const dashboardApi = createDashboardApi(apiClient)
