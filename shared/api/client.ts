/**
 * shared/api/client.ts
 *
 * Platform-agnostic axios client factory.
 * Web and mobile each call createApiClient() with their own configuration:
 *   - Web passes getAccessToken from localStorage / cookie
 *   - Mobile passes getAccessToken from SecureStore
 *
 * Token refresh flow:
 *   On 401, the interceptor attempts a silent token refresh via the
 *   configured refreshEndpoint. If refresh succeeds, it retries the
 *   original request. If refresh also fails, onUnauthorized is called.
 */
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

export interface ApiClientConfig {
  /** Base URL of the Django API, e.g. "http://localhost:8000" */
  baseURL: string
  /** Called before every request to obtain a JWT access token. */
  getAccessToken?: () => Promise<string | null> | string | null
  /** Called to obtain the stored refresh token. */
  getRefreshToken?: () => Promise<string | null> | string | null
  /** Called when refresh succeeds, to persist the new access token. */
  saveAccessToken?: (token: string) => Promise<void> | void
  /**
   * Called when the server returns 401 AND the refresh attempt also fails.
   * Use to redirect to login or clear stored credentials.
   */
  onUnauthorized?: () => void
  /** Endpoint for token refresh. Defaults to /api/auth/token/refresh/ */
  refreshEndpoint?: string
  /** Request timeout in milliseconds. Defaults to 15 000. */
  timeout?: number
}

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const instance = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout ?? 15_000,
    headers: { 'Content-Type': 'application/json' },
  })

  // Attach JWT on every request when a token is available
  instance.interceptors.request.use(async (req: InternalAxiosRequestConfig) => {
    if (config.getAccessToken) {
      const token = await config.getAccessToken()
      if (token) req.headers.set('Authorization', `Bearer ${token}`)
    }
    return req
  })

  let isRefreshing = false
  let pendingQueue: Array<{
    resolve: (token: string) => void
    reject: (err: unknown) => void
  }> = []

  function drainQueue(token: string) {
    pendingQueue.forEach((p) => p.resolve(token))
    pendingQueue = []
  }

  function rejectQueue(err: unknown) {
    pendingQueue.forEach((p) => p.reject(err))
    pendingQueue = []
  }

  instance.interceptors.response.use(
    (res: AxiosResponse) => res,
    async (error: { response?: { status: number }; config?: InternalAxiosRequestConfig & { _retry?: boolean } }) => {
      const originalRequest = error.config

      if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
        if (error.response?.status === 401 && config.onUnauthorized) {
          config.onUnauthorized()
        }
        return Promise.reject(error)
      }

      // Try to refresh
      if (!config.getRefreshToken || !config.saveAccessToken) {
        config.onUnauthorized?.()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Queue subsequent 401s until refresh completes
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
              if (originalRequest) {
                originalRequest.headers.set('Authorization', `Bearer ${token}`)
                resolve(instance(originalRequest))
              }
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = await config.getRefreshToken()
        if (!refreshToken) throw new Error('No refresh token')

        const refreshUrl = config.refreshEndpoint ?? '/api/auth/token/refresh/'
        const activeBaseUrl = String(instance.defaults.baseURL ?? config.baseURL ?? '').replace(/\/+$/, '')
        const { data } = await axios.post<{ access: string }>(
          `${activeBaseUrl}${refreshUrl}`,
          { refresh: refreshToken },
          { timeout: config.timeout ?? 15_000 },
        )

        const newToken = data.access
        await config.saveAccessToken(newToken)
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`)
        drainQueue(newToken)
        return instance(originalRequest)
      } catch (refreshError) {
        rejectQueue(refreshError)
        config.onUnauthorized?.()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    },
  )

  return instance
}
