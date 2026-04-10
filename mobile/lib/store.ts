/**
 * @file mobile/lib/store.ts
 * @description Zustand state stores for the CargoTrack Expo mobile app.
 *
 * Stores
 * ------
 * `useAuthStore` — Authentication state backed by `expo-secure-store`.
 *   Tokens are stored under the keys `access_token` and `refresh_token`.
 *   On app launch, `loadStoredTokens()` is called by `_layout.tsx` to
 *   restore session state before the splash screen hides.
 *   iOS/Android difference: SecureStore uses the device Keychain (iOS) and
 *   Android Keystore; values survive app restarts but not device wipes.
 *
 * `useAlertStore` — Alert list and unread badge count.
 *   `fetchAlerts(client)` accepts the Axios instance as an argument so the
 *   store remains decoupled from the singleton in `lib/api.ts` and can be
 *   tested with a mock client.  Alerts are held in memory only — not persisted
 *   to SecureStore — so they refresh on every app foreground event.
 *
 * Dependency: `EXPO_PUBLIC_API_URL` must be set in `mobile/.env` for physical
 * device testing; Android emulator falls back to `http://10.0.2.2:8000` and
 * iOS simulator to `http://localhost:8000` (via `lib/api.ts`).
 */
import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { AxiosInstance } from 'axios'
import type { User, Alert } from '@shared/api/types'

// ── Auth store ────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setTokens: (access: string, refresh: string) => Promise<void>
  setUser: (user: User) => void
  logout: () => Promise<void>
  loadStoredTokens: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync('access_token', access)
    await SecureStore.setItemAsync('refresh_token', refresh)
    set({ isAuthenticated: true })
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token')
    await SecureStore.deleteItemAsync('refresh_token')
    set({ user: null, isAuthenticated: false })
  },

  loadStoredTokens: async () => {
    const access = await SecureStore.getItemAsync('access_token')
    if (access) {
      set({ isAuthenticated: true })
      return true
    }
    return false
  },
}))

// ── Alert store ───────────────────────────────────────────────────────────────

interface AlertState {
  alerts: Alert[]
  unreadCount: number
  isLoading: boolean
  setAlerts: (alerts: Alert[]) => void
  acknowledgeLocal: (id: number) => void
  fetchAlerts: (client: AxiosInstance) => Promise<void>
}

export const useAlertStore = create<AlertState>()((set) => ({
  alerts: [],
  unreadCount: 0,
  isLoading: false,

  setAlerts: (alerts) =>
    set({ alerts, unreadCount: alerts.filter((a) => !a.acknowledged).length }),

  acknowledgeLocal: (id) =>
    set((state) => {
      const updated = state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a,
      )
      return { alerts: updated, unreadCount: updated.filter((a) => !a.acknowledged).length }
    }),

  fetchAlerts: async (client) => {
    set({ isLoading: true })
    try {
      const res = await client.get<{ count: number; results: Alert[] }>(
        '/api/v1/alerts/',
      )
      const alerts: Alert[] = res.data.results ?? []
      set({
        alerts,
        unreadCount: alerts.filter((a) => !a.acknowledged).length,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },
}))
