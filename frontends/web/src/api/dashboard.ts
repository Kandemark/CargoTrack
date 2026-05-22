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
   * GET /api/v1/dashboard/platform/analytics/
   * Returns comprehensive platform analytics: revenue trends, shipment stats,
   * fleet utilisation, user distribution, alerts, marketplace, cold chain.
   */
  getPlatformAnalytics: () => apiClient.get<PlatformAnalyticsResponse>('/api/v1/dashboard/platform/analytics/'),

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

// ── Platform Analytics ──────────────────────────────────────────────────────

export interface MonthlyRevenue {
  month: string
  revenue: number
  count: number
}

export interface OrgShipmentStats {
  client__organization__name: string
  total: number
  in_transit: number
  delivered: number
  delayed: number
  pending: number
  customs: number
}

export interface DailyVolume {
  day: string
  count: number
}

export interface InvoiceAging {
  overdue_count: number
  overdue_total: number
  paid_30d_count: number
  paid_30d_total: number
}

export interface FleetStats {
  total_trucks: number
  active_trucks: number
  total_drivers: number
  on_route_drivers: number
  avg_utilisation: number
}

export interface TopCarrier {
  name: string
  on_time_rate: number
  rating: number
  total_shipments: number
  active_shipments: number
}

export interface RoleCount {
  role: string
  count: number
}

export interface OrgUserCount {
  organization__name: string
  count: number
}

export interface AlertSummaryItem {
  severity: string
  count: number
}

export interface MarketplaceStats {
  active_listings: number
  bids_last_30d: number
  awarded_last_30d: number
}

export interface ColdChainStats {
  active_shipments: number
  active_excursions: number
}

export interface CorridorSummary {
  corridor: string
  total: number
  delivered: number
}

export interface OrgHealth {
  name: string
  members: number
  shipments: number
  delivered: number
  on_time_pct: number
  revenue_kes: number
}

export interface PlatformAnalyticsResponse {
  monthly_revenue: MonthlyRevenue[]
  org_shipment_stats: OrgShipmentStats[]
  daily_volume: DailyVolume[]
  invoice_aging: InvoiceAging
  fleet: FleetStats
  top_carriers: TopCarrier[]
  users_by_role: RoleCount[]
  users_by_org: OrgUserCount[]
  new_users_30d: number
  alert_summary: AlertSummaryItem[]
  unacked_alerts: number
  marketplace: MarketplaceStats
  coldchain: ColdChainStats
  corridor_volume: CorridorSummary[]
  org_health: OrgHealth[]
}
