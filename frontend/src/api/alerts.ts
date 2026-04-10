/**
 * frontend/src/api/alerts.ts
 *
 * API functions for the alerts domain.  The acknowledge endpoint requires
 * LOGISTICS_MGR or ADMIN role on the backend (IsManagerUser permission).
 *
 * Endpoint coverage:
 *   GET  /api/v1/alerts/                     — unacked alerts by default
 *   POST /api/v1/alerts/<id>/acknowledge/    — mark alert as acknowledged
 */
import apiClient from './client'
import type { Alert, PaginatedResponse } from '@/types'

export const alertsApi = {
  /**
   * GET /api/v1/alerts/
   * Returns unacknowledged alerts by default.
   * Pass { all: '1' } to include acknowledged alerts (managers only).
   */
  getAlerts: (params?: { all?: '1' }) =>
    apiClient.get<PaginatedResponse<Alert>>('/api/v1/alerts/', { params }),

  /**
   * POST /api/v1/alerts/<pk>/acknowledge/
   * Marks an alert as acknowledged. Requires Manager or Admin role.
   */
  acknowledgeAlert: (id: number) =>
    apiClient.post<Alert>(`/api/v1/alerts/${id}/acknowledge/`),
}
