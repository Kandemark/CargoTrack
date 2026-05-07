import apiClient from './client'

export interface Integration {
  id: number
  name: string
  category: 'CUSTOMS' | 'PORT' | 'CARRIER' | 'PAYMENTS' | 'FINANCE' | 'MAPS' | 'COMMS'
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  api_url: string
  api_usage_pct: number
  has_webhook: boolean
  last_sync: string | null
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const integrationsApi = {
  list: (params?: { category?: string }) =>
    apiClient.get<Integration[]>('/api/v1/integrations/', { params }),

  get: (id: number) =>
    apiClient.get<Integration>(`/api/v1/integrations/${id}/`),

  create: (data: Partial<Integration>) =>
    apiClient.post<Integration>('/api/v1/integrations/', data),

  update: (id: number, data: Partial<Integration>) =>
    apiClient.patch<Integration>(`/api/v1/integrations/${id}/`, data),

  delete: (id: number) =>
    apiClient.delete(`/api/v1/integrations/${id}/`),
}
