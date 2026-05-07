/**
 * shared/api/dashboard.ts — Dashboard & Alerts API factory
 * ==========================================================
 *
 * Returns a dashboard API object bound to the provided Axios instance.
 * Used directly by the Expo mobile app; the React web app has its own
 * wrappers in `frontend/src/api/dashboard.ts` and `frontend/src/api/alerts.ts`.
 *
 * Endpoint coverage:
 *   GET  /api/v1/dashboard/stats/            — full KPI + events + carriers
 *   GET  /api/v1/alerts/                     — unacked alerts (paginated)
 *   POST /api/v1/alerts/<id>/acknowledge/    — acknowledge an alert
 */
import type { AxiosInstance } from 'axios'
import type { DashboardResponse, Alert, PaginatedResponse } from './types'

export function createDashboardApi(client: AxiosInstance) {
  return {
    getStats: () =>
      client.get<DashboardResponse>('/api/v1/dashboard/stats/'),

    getAlerts: (params?: { all?: boolean }) =>
      client.get<PaginatedResponse<Alert>>('/api/v1/alerts/', { params }),

    acknowledgeAlert: (id: number) =>
      client.post(`/api/v1/alerts/${id}/acknowledge/`),
  }
}
