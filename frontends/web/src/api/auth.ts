/**
 * frontend/src/api/auth.ts
 *
 * API functions for authentication.  JWT tokens are stored as httpOnly cookies
 * (ct_access, ct_refresh) set by the backend — JavaScript never touches them.
 *
 * Endpoint coverage:
 *   POST /api/auth/token/          — obtain JWT pair (sets cookies)
 *   POST /api/auth/register/       — create account + set cookies
 *   POST /api/auth/token/refresh/  — get new access token cookie
 *   POST /api/auth/token/logout/   — clear cookies + blacklist refresh token
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
  /** POST /api/auth/token/ — exchange credentials for a JWT pair (cookies set by backend). */
  login: (credentials: { username: string; password: string }) =>
    apiClient.post<TokenPair>('/api/auth/token/', credentials),

  /** POST /api/auth/register/ — create a new account (cookies set by backend). */
  register: (data: RegisterPayload) =>
    apiClient.post<TokenPair>('/api/auth/register/', data),

  /** POST /api/auth/token/refresh/ — refresh the access token cookie via refresh cookie. */
  refreshToken: () =>
    apiClient.post<Pick<TokenPair, 'access'>>('/api/auth/token/refresh/'),

  /** POST /api/auth/token/logout/ — clear cookies and blacklist refresh token. */
  logout: () =>
    apiClient.post('/api/auth/token/logout/'),

  /** GET /api/v1/accounts/me/ — return the authenticated user's profile. */
  getMe: () => apiClient.get<User>('/api/v1/accounts/me/'),

  /** PATCH /api/v1/accounts/me/ — update editable profile fields. */
  updateMe: (data: Partial<Pick<User, 'first_name' | 'last_name' | 'phone'>>) =>
    apiClient.patch<User>('/api/v1/accounts/me/', data),
}
