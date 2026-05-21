/**
 * frontend/src/api/dashboard.ts
 *
 * API functions for the logistics dashboard.
 *
 * Endpoint coverage:
 *   GET /api/v1/dashboard/stats/        — full payload: summary + events + carriers (auth required)
 *   GET /api/v1/dashboard/kpis/         — compact KPI cards for the dashboard header (auth required)
 *   GET /api/v1/dashboard/public-stats/ — live stats + map dots for the landing page (AllowAny)
 */
import apiClient from './client'
import type { DashboardResponse, DashboardSummary, PublicLandingStats } from '@/types'

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

  /**
   * GET /api/v1/dashboard/platform/revenue/
   * Returns revenue per organization, corridor volume, clearance rate, and
   * active conversation count. PLATFORM_OWNER only.
   */
  getPlatformRevenue: () => apiClient.get<PlatformRevenueResponse>('/api/v1/dashboard/platform/revenue/'),

  /**
   * GET /api/v1/dashboard/public-stats/
   * Returns live aggregate stats and anonymized active shipment dots for the
   * public landing page. No authentication required.
   */
  getPublicStats: () => apiClient.get<PublicLandingStats>('/api/v1/dashboard/public-stats/'),
}

export interface RevenueByOrg {
  name: string
  revenue_kes: number
  invoice_count: number
}

export interface CorridorVolume {
  corridor: string
  origin: string
  destination: string
  total: number
  pending: number
  in_transit: number
  customs: number
  delivered: number
  delayed: number
}

export interface PlatformRevenueResponse {
  revenue_by_org: RevenueByOrg[]
  corridor_volume: CorridorVolume[]
  clearance_rate: number
  active_conversations: number
}
