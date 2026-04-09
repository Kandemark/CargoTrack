/**
 * shared/api/client.ts
 *
 * Platform-agnostic axios client factory.
 * Web and mobile each call createApiClient() with their own configuration:
 *   - Web passes getAccessToken from localStorage / cookie
 *   - Mobile passes getAccessToken from SecureStore
 *
 * Neither platform-specific global (document, window, SecureStore) is
 * referenced here.
 */
import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'

export interface ApiClientConfig {
  /** Base URL of the Django API, e.g. "http://localhost:8000" */
  baseURL: string
  /**
   * Called before every request to obtain a JWT access token.
   * Return null if no token is available (unauthenticated state).
   */
  getAccessToken?: () => Promise<string | null> | string | null
  /**
   * Called when the server returns 401. Use to redirect to login
   * or clear stored credentials.
   */
  onUnauthorized?: () => void
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
      if (token) {
        req.headers.set('Authorization', `Bearer ${token}`)
      }
    }
    return req
  })

  // Centralised 401 handling
  instance.interceptors.response.use(
    (res: AxiosResponse) => res,
    (error: { response?: { status: number } }) => {
      if (error.response?.status === 401 && config.onUnauthorized) {
        config.onUnauthorized()
      }
      return Promise.reject(error)
    },
  )

  return instance
}
