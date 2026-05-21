/**
 * predictions.ts — API client for standalone ML prediction endpoints.
 */
import apiClient from './client'

export interface DelayPrediction {
  tracking_number: string
  delay_risk_score: number
  predicted_delay_hours: number
  confidence: number
  factors: string[]
}

export interface DemandForecast {
  corridor: string
  forecast_demand_teu: number
  forecast_period: string
  confidence_interval: { low: number; high: number }
  trend: string
  factors: string[]
}

export interface PricingRecommendation {
  route: string
  recommended_rate_usd: number
  current_market_rate_usd: number
  confidence: number
  reasoning: string
  factors: string[]
}

export interface TheftRisk {
  route_segment: string
  theft_risk_score: number
  risk_level: string
  historical_incidents: number
  recommendations: string[]
}

export interface DriverScore {
  driver_id: number
  driver_name: string
  overall_score: number
  safety_score: number
  efficiency_score: number
  reliability_score: number
  insights: string[]
}

export interface BorderDelay {
  border_name: string
  predicted_wait_hours: number
  confidence: number
  best_crossing_window: string
  factors: string[]
}

export interface FuelOptimization {
  route: string
  optimal_speed_kmh: number
  estimated_fuel_savings_pct: number
  estimated_cost_savings_usd: number
  recommendations: string[]
}

export interface ContainerMatch {
  shipment_tracking: string
  recommended_container_type: string
  match_score: number
  alternatives: string[]
  reasoning: string
}

export interface ShipmentPrediction {
  tracking_number: string
  delay_risk: number
  estimated_arrival: string
  route_risk_score: number
  weather_impact: string
  border_crossing_delays: number
  recommendations: string[]
}

export const predictionsApi = {
  /** POST /api/v1/predictions/delay/ — shipment delay prediction */
  delay: (data: { tracking_number: string }) =>
    apiClient.post<DelayPrediction>('/api/v1/predictions/delay/', data),

  /** POST /api/v1/predictions/demand/ — corridor demand forecast */
  demand: (data: { corridor?: string; period_months?: number }) =>
    apiClient.post<DemandForecast>('/api/v1/predictions/demand/', data),

  /** POST /api/v1/predictions/pricing/ — rate pricing recommendation */
  pricing: (data: { origin: string; destination: string; container_type?: string }) =>
    apiClient.post<PricingRecommendation>('/api/v1/predictions/pricing/', data),

  /** POST /api/v1/predictions/theft-risk/ — route theft risk assessment */
  theftRisk: (data: { origin: string; destination: string }) =>
    apiClient.post<TheftRisk>('/api/v1/predictions/theft-risk/', data),

  /** POST /api/v1/predictions/driver-score/ — driver performance scoring */
  driverScore: (data: { driver_id: number }) =>
    apiClient.post<DriverScore>('/api/v1/predictions/driver-score/', data),

  /** POST /api/v1/predictions/border-delay/ — border crossing delay prediction */
  borderDelay: (data: { border_name: string }) =>
    apiClient.post<BorderDelay>('/api/v1/predictions/border-delay/', data),

  /** POST /api/v1/predictions/fuel-optimize/ — fuel optimization recommendations */
  fuelOptimize: (data: { origin: string; destination: string; vehicle_type?: string }) =>
    apiClient.post<FuelOptimization>('/api/v1/predictions/fuel-optimize/', data),

  /** POST /api/v1/predictions/container-match/ — container type matching */
  containerMatch: (data: { shipment_id?: number; cargo_type?: string; weight_kg?: number }) =>
    apiClient.post<ContainerMatch>('/api/v1/predictions/container-match/', data),

  /** POST /api/v1/predictions/shipment/ — comprehensive shipment prediction */
  shipment: (data: { tracking_number: string }) =>
    apiClient.post<ShipmentPrediction>('/api/v1/predictions/shipment/', data),
}
