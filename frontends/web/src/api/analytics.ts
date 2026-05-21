import apiClient from './client'

// ── Shared types ────────────────────────────────────────────────────────────

export interface CarrierPerf {
  carrier_name: string
  total: number
  delivered: number
  avg_risk: number
  on_time_rate: number
}

export interface MonthlyPoint {
  month: string
  revenue?: number
  avg_risk?: number
  emissions?: number
  offset?: number
}

export interface AnalyticsData {
  total_shipments: number
  status_counts: Record<string, number>
  on_time_rate: number
  avg_risk: number
  carrier_performance: CarrierPerf[]
  monthly_revenue: MonthlyPoint[]
  monthly_risk: MonthlyPoint[]
}

// ── Profit ──────────────────────────────────────────────────────────────────

export interface ProfitCarrier {
  carrier_name: string
  revenue: number
  cost: number
  profit: number
  shipments: number
  margin_pct: number
}

export interface ProfitRoute {
  route: string
  revenue: number
  cost: number
  profit: number
  count: number
  margin_pct: number
}

export interface ProfitMonthly {
  month: string
  revenue: number
  cost: number
  profit: number
  margin_pct: number
}

export interface ProfitData {
  margin_pct: number
  revenue_total: number
  cost_total: number
  profit_total: number
  monthly: ProfitMonthly[]
  by_carrier: ProfitCarrier[]
  by_route: ProfitRoute[]
}

// ── Route analytics ─────────────────────────────────────────────────────────

export interface RouteAnalytics {
  route: string
  origin: string
  destination: string
  shipment_count: number
  on_time_rate: number
  avg_risk: number
  avg_distance: number
  total_revenue: number
  avg_margin: number
}

export interface RouteAnalyticsData {
  routes: RouteAnalytics[]
}

// ── Carrier benchmarking ────────────────────────────────────────────────────

export interface CarrierBenchmark {
  carrier_name: string
  shipment_count: number
  on_time_rate: number
  avg_risk: number
  revenue: number
  margin_pct: number
  on_time_percentile: number
  risk_percentile: number
  margin_percentile: number
}

export interface CarrierBenchmarkData {
  carriers: CarrierBenchmark[]
}

// ── Corridor analytics ──────────────────────────────────────────────────────

export interface CorridorAnalytics {
  corridor_name: string
  shipment_count: number
  active: number
  delayed: number
  on_time_rate: number
  avg_risk: number
  avg_weight_kg: number
  avg_distance_km: number
  total_volume_kg: number
  congestion_index: number
}

export interface CorridorAnalyticsData {
  corridors: CorridorAnalytics[]
}

// ── Customer analytics ──────────────────────────────────────────────────────

export interface CustomerAnalytics {
  client_id: number
  client_name: string
  company: string
  total_shipments: number
  active_shipments: number
  on_time_rate: number
  avg_risk: number
  total_spend: number
  avg_shipment_value: number
  preferred_carrier: string | null
  last_shipment_date: string | null
}

export interface CustomerAnalyticsData {
  customers: CustomerAnalytics[]
}

// ── Temporal analytics ──────────────────────────────────────────────────────

export interface HourlyPattern {
  hour: number
  count: number
  avg_risk: number
}

export interface WeekdayPattern {
  weekday: string
  count: number
  avg_risk: number
}

export interface MonthlyPattern {
  month: string
  volume: number
  on_time_rate: number
  delivered: number
  on_time: number
}

export interface TemporalData {
  by_hour: HourlyPattern[]
  by_weekday: WeekdayPattern[]
  by_month: MonthlyPattern[]
}

// ── Driver analytics ────────────────────────────────────────────────────────

export interface DriverAnalytics {
  driver_id: string
  name: string
  phone: string
  status: string
  rating: number
  on_time_rate: number
  total_jobs: number
  total_km: number
  earnings_mtd: number
  license_class: string
  license_expiry: string | null
  certifications: string[]
  years_experience: number
}

// ── SLA ─────────────────────────────────────────────────────────────────────

export interface SLAItem {
  id: number
  tracking_number: string
  carrier: string
  route: string
  status: string
  sla_status: 'ON_TIME' | 'AT_RISK' | 'BREACHED'
  breach_hours: number
  scheduled_arrival: string
  actual_arrival: string | null
}

export interface SLAData {
  compliance_pct: number
  total: number
  on_time: number
  at_risk: number
  breached: number
  items: SLAItem[]
}

// ── Carbon ──────────────────────────────────────────────────────────────────

export interface CarbonCarrier {
  name: string
  total_kg: number
  shipments: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'D'
}

export interface CarbonData {
  total_kg: number
  offset_kg: number
  net_kg: number
  monthly: MonthlyPoint[]
  by_carrier: CarbonCarrier[]
}

// ── Performance analytics ─────────────────────────────────────────────────

export interface OnTimeTrendPoint {
  date: string
  total: number
  on_time: number
  rate: number
}

export interface MilesPerRoute {
  route: string
  avg_km: number
  count: number
}

export interface PerformanceData {
  on_time_rate: number
  total_shipments: number
  completed_shipments: number
  avg_distance_km: number
  on_time_trend: OnTimeTrendPoint[]
  bid_success_rate: number
  total_bids: number
  accepted_bids: number
  miles_per_route: MilesPerRoute[]
}

export interface DriverLeaderboardEntry {
  rank: number
  driver_id: string
  name: string
  status: string
  rating: number
  on_time_rate: number
  total_jobs: number
  total_km: number
  completed_jobs: number
  on_time_jobs: number
  earnings_mtd: number
}

export interface BidCarrierPerformance {
  carrier: string
  total_bids: number
  accepted: number
  success_rate: number
  avg_amount: number
}

export interface BidTrendPoint {
  date: string
  total: number
  accepted: number
}

export interface BidAnalyticsData {
  carrier_performance: BidCarrierPerformance[]
  daily_trend: BidTrendPoint[]
  total_bids: number
}

// ── API functions ───────────────────────────────────────────────────────────

export const analyticsApi = {
  get: () =>
    apiClient.get<AnalyticsData>('/api/v1/analytics/'),

  profit: (params?: { date_from?: string; date_to?: string }) =>
    apiClient.get<ProfitData>('/api/v1/analytics/profit/', { params }),

  routes: (params?: { date_from?: string; date_to?: string; carrier?: string }) =>
    apiClient.get<RouteAnalyticsData>('/api/v1/analytics/routes/', { params }),

  carrierBenchmark: (params?: { date_from?: string; date_to?: string }) =>
    apiClient.get<CarrierBenchmarkData>('/api/v1/analytics/carrier-benchmark/', { params }),

  corridors: (params?: { date_from?: string; date_to?: string }) =>
    apiClient.get<CorridorAnalyticsData>('/api/v1/analytics/corridors/', { params }),

  customers: (params?: { date_from?: string; date_to?: string }) =>
    apiClient.get<CustomerAnalyticsData>('/api/v1/analytics/customers/', { params }),

  temporal: (params?: { date_from?: string; date_to?: string }) =>
    apiClient.get<TemporalData>('/api/v1/analytics/temporal/', { params }),

  drivers: () =>
    apiClient.get<DriverAnalytics[]>('/api/v1/fleet/drivers/stats/'),

  sla: (params?: { status?: string }) =>
    apiClient.get<SLAData>('/api/v1/sla/', { params }),

  carbon: () =>
    apiClient.get<CarbonData>('/api/v1/carbon/'),

  exportCsv: (dataset: string, params?: { date_from?: string; date_to?: string }) =>
    apiClient.get(`/api/v1/analytics/export/`, {
      params: { format: 'csv', dataset, ...params },
      responseType: 'blob',
    }),

  performance: (params?: { days?: number }) =>
    apiClient.get<PerformanceData>('/api/v1/analytics/performance/', { params }),

  driverLeaderboard: () =>
    apiClient.get<DriverLeaderboardEntry[]>('/api/v1/analytics/driver-leaderboard/'),

  bidAnalytics: (params?: { days?: number }) =>
    apiClient.get<BidAnalyticsData>('/api/v1/analytics/bid-analytics/', { params }),
}
