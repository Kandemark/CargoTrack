import type { AxiosInstance } from 'axios'
import type { TokenPair, User, UserRole } from './types'

export interface RegisterPayload {
  first_name: string
  last_name:  string
  email:      string
  phone:      string
  role:       UserRole
  password:   string
  password2:  string
  // Organization fields (step 2 of onboarding)
  org_name?:   string
  org_type?:   string
  join_code?:  string
  // Role-specific fields (step 3 of onboarding)
  license_number?:   string
  license_class?:    string
  years_experience?: number
  certifications?:   string[]
  cargo_prefs?:      string[]
  tax_id?:           string
}

export function createAuthApi(client: AxiosInstance) {
  return {
    /**
     * Exchange username + password for a JWT pair.
     * POST /api/auth/token/
     */
    login: (credentials: { username: string; password: string }) =>
      client.post<TokenPair>('/api/auth/token/', credentials),

    /**
     * Create a new user account and return a JWT token pair.
     * POST /api/auth/register/
     * On mobile: navigate to Login after success (don't auto-login).
     */
    register: (payload: RegisterPayload) =>
      client.post<TokenPair>('/api/auth/register/', payload),

    /**
     * Obtain a fresh access token using the stored refresh token.
     * POST /api/auth/token/refresh/
     */
    refresh: (refreshToken: string) =>
      client.post<Pick<TokenPair, 'access'>>('/api/auth/token/refresh/', {
        refresh: refreshToken,
      }),

    /**
     * Blacklist the refresh token on the server (requires simplejwt blacklist).
     * POST /api/auth/token/logout/
     * On web (cookies), the refresh token is sent automatically.  Pass an
     * explicit refresh token for mobile clients.
     */
    logout: (refreshToken?: string) =>
      client.post('/api/auth/token/logout/',
        refreshToken ? { refresh: refreshToken } : {},
      ),

    /**
     * Return the currently authenticated user's profile.
     * GET /api/v1/accounts/me/
     */
    me: () => client.get<User>('/api/v1/accounts/me/'),

    /**
     * Update the authenticated user's editable profile fields.
     * PATCH /api/v1/accounts/me/
     */
    updateMe: (data: Partial<Pick<User, 'first_name' | 'last_name' | 'phone'>>) =>
      client.patch<User>('/api/v1/accounts/me/', data),
  }
}
