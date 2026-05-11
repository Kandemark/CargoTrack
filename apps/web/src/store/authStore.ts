/**
 * frontend/src/store/authStore.ts
 *
 * Zustand store for authentication state.
 *
 * Tokens are stored as httpOnly cookies (ct_access, ct_refresh) set by the
 * Django backend — JavaScript never persists them to disk.  The access token
 * is held in JS memory only (not localStorage) so WebSocket connections can
 * use it for query-string auth.
 *
 * Responsibilities:
 *   - Holds the authenticated User object, isAuthenticated flag, and accessToken.
 *   - Exposes login, register, logout, restoreAccessToken, and clearAuth actions.
 *   - Persists only user profile data to localStorage (no tokens).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type RegisterPayload } from '@/api/auth'
import type { User } from '@/types'

export { type RegisterPayload } from '@/api/auth'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  /** JWT access token held in memory for WebSocket query-string auth. Not persisted. */
  accessToken: string | null

  /** Exchange credentials for tokens (cookies) and fetch user profile. */
  login: (credentials: { username: string; password: string }) => Promise<void>

  /** Register a new account, auto-login on success. */
  register: (payload: RegisterPayload) => Promise<void>

  /** Call logout endpoint to clear cookies, then clear local state. */
  logout: () => Promise<void>

  /** Restore the access token by calling the refresh endpoint (uses httpOnly cookie). */
  restoreAccessToken: () => Promise<void>

  /** Imperatively set the user (e.g. after profile update). */
  setUser: (user: User) => void

  /** Clear auth without hitting the server (for error recovery). */
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,

      login: async (credentials) => {
        // POST /api/auth/token/ — backend sets httpOnly cookies AND returns tokens in body
        const { data: tokens } = await authApi.login(credentials)
        // Fetch user profile now that cookies are set
        const { data: user } = await authApi.getMe()
        set({ user, isAuthenticated: true, accessToken: tokens.access })
      },

      register: async (payload) => {
        const { data: tokens } = await authApi.register(payload)
        // Backend returns tokens in body for mobile compat; cookies are also set.
        if (tokens.access && tokens.refresh) {
          // Registration already sets cookies via the same flow; fetch profile
          const { data: user } = await authApi.getMe()
          set({ user, isAuthenticated: true, accessToken: tokens.access })
        }
      },

      logout: async () => {
        try {
          // POST /api/auth/token/logout/ — blacklists refresh token + clears cookies
          await authApi.logout()
        } catch {
          // Non-fatal — tokens may already be expired
        }
        set({ user: null, isAuthenticated: false, accessToken: null })
      },

      restoreAccessToken: async () => {
        try {
          const { data } = await authApi.refreshToken()
          set({ accessToken: data.access })
        } catch {
          // Refresh failed — user needs to log in again.
          // Clear isAuthenticated so ProtectedRoute doesn't render pages
          // that will immediately 401, causing a redirect loop.
          set({ user: null, isAuthenticated: false, accessToken: null })
        }
      },

      setUser: (user) => set({ user, isAuthenticated: true }),

      clearAuth: () => {
        set({ user: null, isAuthenticated: false, accessToken: null })
      },
    }),
    {
      name: 'ct-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
)
