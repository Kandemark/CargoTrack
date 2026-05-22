/**
 * frontend/src/store/authStore.ts
 *
 * Zustand store for authentication state and admin impersonation.
 *
 * Tokens are stored as httpOnly cookies (ct_access, ct_refresh) set by the
 * Django backend — JavaScript never persists them to disk.  The access token
 * is held in JS memory only (not localStorage) so WebSocket connections can
 * use it for query-string auth.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type RegisterPayload } from '@/api/auth'
import { accountApi } from '@/api/account'
import { setOrgIdProvider } from '@/api/client'
import type { User } from '@/types'

// Wire org-scoping interceptor so every API request carries X-Organization-ID.
setOrgIdProvider(() => useAuthStore.getState().user?.org_id)

export { type RegisterPayload } from '@/api/auth'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  accessToken: string | null
  /** True after the initial auth restoration attempt completes (success or failure). */
  authReady: boolean

  /** Impersonation state — set when an admin is viewing as another user. */
  isImpersonating: boolean
  originalUser: User | null

  login: (credentials: { username: string; password: string }) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  restoreAccessToken: () => Promise<void>
  setUser: (user: User) => void
  clearAuth: () => void

  /** Impersonate a target user (ADMIN / PLATFORM_OWNER only). Returns the target role for navigation. */
  impersonate: (userId: number) => Promise<string | null>
  /** Stop impersonating and revert to the original admin identity. */
  stopImpersonating: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      authReady: false,
      isImpersonating: false,
      originalUser: null,

      login: async (credentials) => {
        const { data: tokens } = await authApi.login(credentials)
        const { data: user } = await authApi.getMe(tokens.access)
        set({ user, isAuthenticated: true, accessToken: tokens.access, isImpersonating: false, originalUser: null })
      },

      register: async (payload) => {
        const { data: tokens } = await authApi.register(payload)
        if (tokens.access && tokens.refresh) {
          const { data: user } = await authApi.getMe()
          set({ user, isAuthenticated: true, accessToken: tokens.access })
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch {
          // Non-fatal — tokens may already be expired
        }
        set({ user: null, isAuthenticated: false, accessToken: null, isImpersonating: false, originalUser: null })
      },

      restoreAccessToken: async () => {
        try {
          const { data } = await authApi.refreshToken()
          set({ accessToken: data.access, authReady: true })
        } catch {
          set({ user: null, isAuthenticated: false, accessToken: null, isImpersonating: false, originalUser: null, authReady: true })
        }
      },

      setUser: (user) => set({ user, isAuthenticated: true }),

      clearAuth: () => {
        set({ user: null, isAuthenticated: false, accessToken: null, isImpersonating: false, originalUser: null })
      },

      impersonate: async (userId: number) => {
        const currentUser = get().user
        const { data } = await accountApi.impersonate(userId)
        const targetRole = data.impersonated_user.role
        set({
          accessToken: data.access,
          user: {
            ...currentUser!,
            id: data.impersonated_user.id,
            username: data.impersonated_user.username,
            first_name: data.impersonated_user.first_name,
            last_name: data.impersonated_user.last_name,
            role: data.impersonated_user.role,
            role_display: data.impersonated_user.role_display,
            org_id: data.impersonated_user.org_id,
            org_name: data.impersonated_user.org_name,
          } as User,
          isImpersonating: true,
          originalUser: currentUser ? { ...currentUser } : null,
        })
        return targetRole
      },

      stopImpersonating: async () => {
        const { data } = await accountApi.stopImpersonating()
        const restored = data.user
        set({
          accessToken: data.access,
          user: {
            ...restored,
            role_display: restored.role_display || restored.role,
            org_id: restored.org_id,
            org_name: restored.org_name,
          } as User,
          isImpersonating: false,
          originalUser: null,
        })
      },
    }),
    {
      name: 'ct-auth',
      partialize: (s) => ({
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        isImpersonating: s.isImpersonating,
        originalUser: s.originalUser,
      }),
    },
  ),
)
