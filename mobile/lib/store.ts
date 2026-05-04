/**
 * @file mobile/lib/store.ts
 * @description Zustand state stores for the CargoTrack Expo mobile app.
 *
 * Stores
 * ------
 * `useAuthStore` — Authentication state backed by `expo-secure-store`.
 * `useAlertStore` — Alert list and unread badge count.
 * `useOnboardingStore` — First-run onboarding state via AsyncStorage.
 */
import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AxiosInstance } from 'axios'
import type { User, Alert } from '@shared/api/types'

// ── Auth store ────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  biometricEnabled: boolean
  setBiometricEnabled: (v: boolean) => void
  setTokens: (access: string, refresh: string) => Promise<void>
  setUser: (user: User) => void
  logout: () => Promise<void>
  loadStoredTokens: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  biometricEnabled: false,

  setBiometricEnabled: (v) => set({ biometricEnabled: v }),

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync('access_token', access)
    await SecureStore.setItemAsync('refresh_token', refresh)
    set({ isAuthenticated: true })
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token').catch(() => null)
    await SecureStore.deleteItemAsync('refresh_token').catch(() => null)
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
      const res = await client.get<{ count: number; results: Alert[] }>('/api/v1/alerts/')
      const alerts: Alert[] = res.data.results ?? []
      set({ alerts, unreadCount: alerts.filter((a) => !a.acknowledged).length, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },
}))

// ── Onboarding store ──────────────────────────────────────────────────────────

const ONBOARD_KEY = 'cargotrack_onboarded_v1'

interface OnboardingState {
  hasOnboarded: boolean | null  // null = not yet loaded from storage
  checkOnboarded: () => Promise<boolean>
  markOnboarded: () => Promise<void>
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  hasOnboarded: null,

  checkOnboarded: async () => {
    const val = await AsyncStorage.getItem(ONBOARD_KEY)
    const done = val === 'true'
    set({ hasOnboarded: done })
    return done
  },

  markOnboarded: async () => {
    await AsyncStorage.setItem(ONBOARD_KEY, 'true')
    set({ hasOnboarded: true })
  },
}))
