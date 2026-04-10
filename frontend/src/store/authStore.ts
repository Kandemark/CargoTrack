/**
 * frontend/src/store/authStore.ts
 *
 * Zustand store for authentication state.
 *
 * Responsibilities:
 *   - Holds the authenticated {@link User} object and `isAuthenticated` flag.
 *   - Exposes `login`, `register`, `logout`, `refreshAccess`, `setUser`, and
 *     `clearAuth` actions that coordinate token storage with server calls.
 *   - Persists `user` and `isAuthenticated` to localStorage under the key
 *     `ct-auth`.  Tokens are stored separately via {@link tokenStorage} so
 *     the Axios interceptor can read them without deserialising Zustand's JSON.
 *
 * Token flow:
 *   login / register → store tokens via tokenStorage → fetch /me → set user
 *   logout           → POST /token/blacklist → clear tokenStorage → clear state
 *   silent refresh   → handled by the Axios interceptor in client.ts; the
 *                       new access token is written via tokenStorage.setAccess
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type RegisterPayload } from '@/api/auth'
import { tokenStorage } from '@/api/client'
import type { User } from '@/types'

// ── JWT decode utility ────────────────────────────────────────────────────────
// Extracts the payload from a JWT without verifying the signature.
// Used to read claims (e.g. role) before the /me round-trip completes.

interface JwtPayload {
  user_id?: number
  role?: string
  exp?: number
  [key: string]: unknown
}

/** Decode a JWT's payload segment. Returns null on any parse error. */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payloadB64] = token.split('.')
    if (!payloadB64) return null
    // atob requires standard Base64; JWT uses URL-safe Base64 (- and _ instead of + and /)
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean

  /** Exchange credentials for tokens, fetch user profile, persist both. */
  login: (credentials: { username: string; password: string }) => Promise<void>

  /** Register a new account, auto-login on success. */
  register: (payload: RegisterPayload) => Promise<void>

  /** Blacklist the refresh token, clear all local auth state. */
  logout: () => Promise<void>

  /** Called by the client interceptor after a successful silent refresh. */
  refreshAccess: () => Promise<void>

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

      login: async (credentials) => {
        const { data: tokens } = await authApi.login(credentials)
        tokenStorage.set(tokens.access, tokens.refresh)
        const { data: user } = await authApi.getMe()
        set({ user, isAuthenticated: true })
      },

      register: async (payload) => {
        console.log('[authStore.register] starting...')
        try {
          const { data: tokens } = await authApi.register(payload)
          console.log('[authStore.register] tokens received:', {
            hasAccess: !!tokens.access, hasRefresh: !!tokens.refresh,
          })
          tokenStorage.set(tokens.access, tokens.refresh)
          console.log('[authStore.register] calling getMe()...')
          const { data: user } = await authApi.getMe()
          console.log('[authStore.register] getMe() returned role:', user.role)
          set({ user, isAuthenticated: true })
          console.log('[authStore.register] done — isAuthenticated: true')
        } catch (err) {
          console.error('[authStore.register] threw:', err)
          throw err  // rethrow so Register.tsx catch block can display the error
        }
      },

      logout: async () => {
        const refresh = tokenStorage.getRefresh()
        if (refresh) {
          try {
            await authApi.logout(refresh)
          } catch {
            // Non-fatal: server may have already invalidated the token
          }
        }
        tokenStorage.clear()
        set({ user: null, isAuthenticated: false })
      },

      refreshAccess: async () => {
        // The client interceptor handles the actual refresh call.
        // This action exists so components can trigger a proactive refresh if needed.
        const refresh = tokenStorage.getRefresh()
        if (!refresh) {
          set({ user: null, isAuthenticated: false })
          return
        }
        const { data } = await authApi.refreshToken(refresh)
        tokenStorage.setAccess(data.access)
      },

      setUser: (user) => set({ user, isAuthenticated: true }),

      clearAuth: () => {
        tokenStorage.clear()
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'ct-auth',
      // Persist only user data; tokens live in their own plain localStorage keys
      // so the client interceptor can read them without parsing Zustand's JSON envelope.
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
)
