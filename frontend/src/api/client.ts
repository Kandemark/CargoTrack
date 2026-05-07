/**
 * frontend/src/api/client.ts
 *
 * Axios instance for all API calls.
 *
 * Authentication is handled via httpOnly cookies set by the Django backend:
 *   - ct_access  — short-lived JWT access token cookie
 *   - ct_refresh — longer-lived JWT refresh token cookie (restricted to /api/auth/token/refresh/)
 *
 * The browser sends these cookies automatically on every same-origin request.
 * To enable cross-origin cookie sending (e.g. API on a different subdomain),
 * set `withCredentials: true` and ensure CORS_ALLOW_CREDENTIALS=true on the backend.
 *
 * On 401, the interceptor calls POST /api/auth/token/refresh/ — the backend
 * reads the refresh cookie, rotates tokens, and sets a new access cookie.
 * If refresh also fails, the user is redirected to /login.
 */
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

// Use relative URLs by default so all /api/... requests go through the Vite
// proxy (dev) or are served by the same Django origin (production).
export const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

// ── Client ────────────────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // Send httpOnly cookies cross-origin
})

// ── 401 → refresh → retry ────────────────────────────────────────────────────

let isRefreshing = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function drainQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token!),
  )
  pendingQueue = []
}

apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then(() => {
        // Retry with fresh cookies (browser sends updated ct_access automatically)
        return apiClient(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      // The refresh endpoint reads the ct_refresh cookie and sets a new ct_access cookie.
      await axios.post(
        `${BASE_URL}/api/auth/token/refresh/`,
        {},
        { withCredentials: true, timeout: 15_000 },
      )
      drainQueue(null, 'refreshed')
      // Retry — browser now has the new ct_access cookie
      return apiClient(original)
    } catch (refreshError) {
      drainQueue(refreshError, null)
      // Clear cookies by calling logout endpoint
      await axios.post(`${BASE_URL}/api/auth/token/logout/`, {}, { withCredentials: true }).catch(() => {})
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export { apiClient }
export default apiClient
