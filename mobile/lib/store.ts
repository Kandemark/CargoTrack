/**
 * mobile/lib/store.ts
 * Zustand auth store backed by expo-secure-store.
 */
import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { User } from '@shared/api/types'

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
