/**
 * frontend/src/api/dashboard.ts
 *
 * API functions for the logistics dashboard.  Both endpoints are read-only
 * and require at minimum the IsAuthenticated permission on the backend.
 *
 * Endpoint coverage:
 *   GET /api/v1/dashboard/stats/ — full payload: summary + events + carriers
 *   GET /api/v1/dashboard/kpis/  — compact KPI cards for the dashboard header
 */
import apiClient from './client'
import type { DashboardResponse, DashboardSummary } from '@/types'

export const dashboardApi = {
  /**
   * GET /api/v1/dashboard/stats/
   * Returns summary KPIs, recent tracking events, and carrier performance.
   */
  getStats: () => apiClient.get<DashboardResponse>('/api/v1/dashboard/stats/'),

  /**
   * GET /api/v1/dashboard/kpis/
   * Returns the full KPI summary (same shape as DashboardResponse.summary).
   */
  getKPIs: () => apiClient.get<DashboardSummary>('/api/v1/dashboard/kpis/'),
}
