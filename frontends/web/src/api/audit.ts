import apiClient from './client'

export interface AuditEntry {
  id: number
  user: number | null
  username: string
  full_name: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT' | 'VIEW'
  resource: string
  description: string
  ip_address: string | null
  result: 'SUCCESS' | 'FAILURE' | 'WARNING'
  metadata: Record<string, unknown>
  created_at: string
}

export const auditApi = {
  list: (params?: { action?: string; result?: string; q?: string; page?: number; page_size?: number }) =>
    apiClient.get<{ results: AuditEntry[]; count: number }>('/api/v1/audit/', { params }),

  create: (data: Partial<AuditEntry>) =>
    apiClient.post<AuditEntry>('/api/v1/audit/create/', data),
}
