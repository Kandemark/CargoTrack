/**
 * frontend/src/api/auth.ts
 *
 * API functions for authentication and user profile management.
 * Token lifecycle functions are called both directly (login/register/logout)
 * and by the Axios interceptor in client.ts (refreshToken).
 *
 * Endpoint coverage:
 *   POST /api/auth/token/          — obtain JWT pair (login)
 *   POST /api/auth/register/       — create account + return JWT pair
 *   POST /api/auth/token/refresh/  — get new access token from refresh token
 *   POST /api/auth/token/blacklist/ — invalidate refresh token (logout)
 *   GET  /api/v1/accounts/me/      — fetch authenticated user profile
 *   PATCH /api/v1/accounts/me/     — update editable profile fields
 */
import apiClient from './client'
import type { TokenPair, User } from '@/types'

export interface RegisterPayload {
  first_name: string
  last_name:  string
  email:      string
  phone:      string
  role:       string
  password:   string
  password2:  string
  org_name?:  string
  org_type?:  string
  join_code?: string
  license_number?:  string
  license_class?:   string
  years_experience?: number
  certifications?:   string[]
  cargo_prefs?:      string[]
  tax_id?:           string
}

export const authApi = {
  /** POST /api/auth/token/ — exchange credentials for a JWT pair. */
  login: (credentials: { username: string; password: string }) =>
    apiClient.post<TokenPair>('/api/auth/token/', credentials),

  /** POST /api/auth/register/ — create a new account and return a JWT pair. */
  register: (data: RegisterPayload) =>
    apiClient.post<TokenPair>('/api/auth/register/', data),

  /** POST /api/auth/token/refresh/ — get a new access token. */
  refreshToken: (refresh: string) =>
    apiClient.post<Pick<TokenPair, 'access'>>('/api/auth/token/refresh/', { refresh }),

  /** POST /api/auth/token/blacklist/ — invalidate the refresh token on logout. */
  logout: (refresh: string) =>
    apiClient.post('/api/auth/token/blacklist/', { refresh }),

  /** GET /api/v1/accounts/me/ — return the authenticated user's profile. */
  getMe: () => apiClient.get<User>('/api/v1/accounts/me/'),

  /** PATCH /api/v1/accounts/me/ — update editable profile fields. */
  updateMe: (data: Partial<Pick<User, 'first_name' | 'last_name' | 'phone'>>) =>
    apiClient.patch<User>('/api/v1/accounts/me/', data),
}
