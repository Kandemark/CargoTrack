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
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import axios from 'axios'

import { createApiClient } from '@shared/api/client'
import { createAuthApi } from '@shared/api/auth'
import { createShipmentsApi } from '@shared/api/shipments'
import { createDashboardApi } from '@shared/api/dashboard'
import {
  clearStoredApiBaseUrl,
  normalizeApiBaseUrl,
  discoverApiServer,
  resolveDefaultApiBaseUrl,
  getStoredApiBaseUrl,
  saveApiBaseUrl,
  resetDiscovery,
} from './runtime-config'

let currentBaseUrl = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000')

async function handleUnauthorized() {
  await SecureStore.deleteItemAsync('access_token')
  await SecureStore.deleteItemAsync('refresh_token')
  // Also clear Zustand store — import lazily to avoid circular dependency
  const { useAuthStore } = await import('./store')
  useAuthStore.getState().logout()
  router.replace('/(auth)/login')
}

export const apiClient = createApiClient({
  baseURL: currentBaseUrl,
  getAccessToken: () => SecureStore.getItemAsync('access_token'),
  getRefreshToken: () => SecureStore.getItemAsync('refresh_token'),
  saveAccessToken: (token) => SecureStore.setItemAsync('access_token', token),
  onUnauthorized: () => void handleUnauthorized(),
  refreshEndpoint: '/api/auth/token/refresh/',
})

export const authApi      = createAuthApi(apiClient)
export const shipmentsApi = createShipmentsApi(apiClient)
export const dashboardApi = createDashboardApi(apiClient)

export interface ApiConnectionCheck {
  baseUrl: string
  healthStatus: number | null
  authStatus: number | null
  healthOk: boolean
  authOk: boolean
}

export function getCurrentApiBaseUrl() {
  return currentBaseUrl
}

export async function initializeApiBaseUrl() {
  // Auto-discover the API server — probes candidate URLs and picks the
  // first reachable one.  This means the user never has to type an IP.
  currentBaseUrl = await discoverApiServer()
  apiClient.defaults.baseURL = currentBaseUrl
  return currentBaseUrl
}

export async function updateApiBaseUrl(value: string) {
  // After manual change, clear the cached discovery so the next probe
  // respects the new URL.
  resetDiscovery()
  const next = await saveApiBaseUrl(value)
  currentBaseUrl = next
  apiClient.defaults.baseURL = next
  return next
}

export async function resetApiBaseUrl() {
  await clearStoredApiBaseUrl()
  resetDiscovery()
  currentBaseUrl = await discoverApiServer()
  apiClient.defaults.baseURL = currentBaseUrl
  return currentBaseUrl
}

export async function checkApiHealth(targetBaseUrl?: string) {
  const baseUrl = normalizeApiBaseUrl(targetBaseUrl || currentBaseUrl)
  const result = await checkApiConnection(baseUrl)

  if (!result.healthOk && !result.authOk) {
    throw new Error('CargoTrack API endpoints were not detected on this server.')
  }

  const response = await axios.get(`${baseUrl}/api/health/`, {
    timeout: 6000,
    validateStatus: (status) => status >= 200 && status < 500,
  })

  return (response.data || {
    status: 'ok',
    service: 'CargoTrack API',
    timestamp: new Date().toISOString(),
    version: 'unknown',
  }) as {
    status: string
    service: string
    timestamp: string
    version: string
  }
}

export async function checkApiConnection(targetBaseUrl?: string): Promise<ApiConnectionCheck> {
  const baseUrl = normalizeApiBaseUrl(targetBaseUrl || currentBaseUrl)

  const [healthResponse, authResponse] = await Promise.all([
    axios.get(`${baseUrl}/api/health/`, {
      timeout: 6000,
      validateStatus: () => true,
    }).catch(() => null),
    axios.options(`${baseUrl}/api/auth/token/`, {
      timeout: 6000,
      validateStatus: () => true,
    }).catch(() => null),
  ])

  const healthStatus = healthResponse?.status ?? null
  const authStatus = authResponse?.status ?? null
  const healthOk = healthStatus === 200
  const authOk = authStatus !== null && authStatus !== 404 && authStatus < 500

  return {
    baseUrl,
    healthStatus,
    authStatus,
    healthOk,
    authOk,
  }
}
