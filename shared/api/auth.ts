import type { AxiosInstance } from 'axios'
import type { TokenPair, User } from './types'

export function createAuthApi(client: AxiosInstance) {
  return {
    /**
     * Exchange username + password for a JWT pair.
     * POST /api/auth/token/
     */
    login: (credentials: { username: string; password: string }) =>
      client.post<TokenPair>('/api/auth/token/', credentials),

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
     * POST /api/auth/token/blacklist/
     */
    logout: (refreshToken: string) =>
      client.post('/api/auth/token/blacklist/', { refresh: refreshToken }),

    /**
     * Return the currently authenticated user's profile.
     * GET /api/v1/accounts/me/
     */
    me: () => client.get<User>('/api/v1/accounts/me/'),

    /**
     * Update the authenticated user's editable profile fields.
     * PATCH /api/v1/accounts/me/
     */
    updateMe: (data: Partial<Pick<User, 'first_name' | 'last_name' | 'company' | 'phone'>>) =>
      client.patch<User>('/api/v1/accounts/me/', data),
  }
}
