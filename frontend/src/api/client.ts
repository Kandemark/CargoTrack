import { createApiClient } from '@shared/api/client'
import type { InternalAxiosRequestConfig } from 'axios'

function getCsrfToken(): string | null {
  return (
    document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1] ?? null
  )
}

export const apiClient = createApiClient({
  baseURL: '/api',
  onUnauthorized: () => {
    window.location.href = '/login'
  },
  // CSRF is injected in the request interceptor below (web-specific)
})

// Attach Django CSRF token on every mutating request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method ?? '')) {
    const csrf = getCsrfToken()
    if (csrf) config.headers['X-CSRFToken'] = csrf
  }
  return config
})

export default apiClient
