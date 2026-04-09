import type { AxiosInstance } from 'axios'
import type { DashboardResponse, Alert } from './types'

export function createDashboardApi(client: AxiosInstance) {
  return {
    getStats: () =>
      client.get<DashboardResponse>('/api/v1/dashboard/stats/'),

    getAlerts: (params?: { all?: boolean }) =>
      client.get<Alert[]>('/api/v1/alerts/', { params }),

    acknowledgeAlert: (id: number) =>
      client.post(`/api/v1/alerts/${id}/acknowledge/`),
  }
}
