/**
 * frontend/src/api/client.ts
 *
 * Axios instance for all API calls.
 *
 * - baseURL from VITE_API_URL (default: http://localhost:8000)
 * - Attaches JWT access token from localStorage on every request
 * - Intercepts 401: attempts one silent token refresh, retries the original
 *   request with the new token, and on refresh failure clears auth state and
 *   redirects to /login
 */
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

// Use relative URLs by default so all /api/... requests go through the Vite
// proxy (dev) or are served by the same Django origin (production).
// Set VITE_API_URL to an absolute URL only when the API is on a different host.
export const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

// ── Token storage ─────────────────────────────────────────────────────────────

const KEYS = { access: 'ct_access', refresh: 'ct_refresh' } as const

export const tokenStorage = {
  getAccess:  (): string | null => localStorage.getItem(KEYS.access),
  getRefresh: (): string | null => localStorage.getItem(KEYS.refresh),
  set: (access: string, refresh: string): void => {
    localStorage.setItem(KEYS.access, access)
    localStorage.setItem(KEYS.refresh, refresh)
  },
  setAccess: (access: string): void => {
    localStorage.setItem(KEYS.access, access)
  },
  clear: (): void => {
    localStorage.removeItem(KEYS.access)
    localStorage.removeItem(KEYS.refresh)
  },
}

// ── Client ────────────────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token on every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
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

    // If another refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return apiClient(original)
      })
    }

    original._retry = true
    isRefreshing = true

    const refreshToken = tokenStorage.getRefresh()
    if (!refreshToken) {
      tokenStorage.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      // Use a plain axios call (not apiClient) to avoid interceptor re-entry
      const { data } = await axios.post<{ access: string }>(
        `${BASE_URL}/api/auth/token/refresh/`,
        { refresh: refreshToken },
      )
      tokenStorage.setAccess(data.access)
      original.headers.Authorization = `Bearer ${data.access}`
      drainQueue(null, data.access)
      return apiClient(original)
    } catch (refreshError) {
      drainQueue(refreshError, null)
      tokenStorage.clear()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export { apiClient }
export default apiClient
