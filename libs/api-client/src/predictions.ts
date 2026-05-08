/**
 * @cargotrack/api-client/predictions
 *
 * ML prediction endpoints — delay risk, demand forecasting, dynamic pricing,
 * theft risk, driver scoring, border delays, fuel optimization, container matching.
 */
import type { AxiosInstance } from "axios";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DelayPredictionRequest {
  shipment_id?: string;
  corridor: string;
  weight_tonnes?: number;
  distance_km?: number;
  hour_of_departure?: number;
  day_of_week?: number;
  month?: number;
  has_customs_stop?: boolean;
}

export interface DelayPredictionResponse {
  shipment_id?: string;
  delay_risk_score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  features_used: Record<string, unknown>;
}

export interface DemandForecastRequest {
  corridor: string;
  weeks_ahead?: number;
}

export interface DemandForecastResponse {
  corridor: string;
  weeks_ahead: number;
  baseline_weekly: number | null;
  forecast: number[];
}

export interface PricingRequest {
  corridor: string;
  commodity?: string;
  weight_tonnes?: number;
  distance_km?: number;
  truck_capacity_pct?: number;
  fuel_price_index?: number;
  days_to_pickup?: number;
  available_trucks?: number;
  pending_shipments?: number;
  month?: number;
}

export interface PricingResponse {
  recommended_rate_usd: number;
  confidence_interval: [number, number];
  factors: Record<string, number>;
}

export interface TheftRiskRequest {
  corridor: string;
  commodity?: string;
  vehicle_type?: string;
  declared_value_usd?: number;
  num_stops?: number;
  armed_escort?: boolean;
  hour_of_day?: number;
  is_weekend?: boolean;
  is_rainy_season?: boolean;
  distance_km?: number;
}

export interface TheftRiskResponse {
  risk_score: number;
  risk_level: string;
  factors: Record<string, number>;
}

export interface DriverScoreRequest {
  driver?: {
    driver_id: string;
    trips_completed: number;
    on_time_pct: number;
    incident_count: number;
    avg_speed_kmh: number;
    fuel_efficiency_score: number;
    years_experience: number;
  };
  drivers?: Array<DriverScoreRequest["driver"]>;
}

export interface DriverScoreResponse {
  driver_id?: string;
  composite_score: number;
  tier: string;
  breakdown: Record<string, number>;
}

export interface BorderDelayRequest {
  border: string;
  hour?: number;
  weekday?: number;
  queue_depth?: number;
  is_weekend?: boolean;
  is_rainy_season?: boolean;
  commodity?: string;
  is_red_lane?: boolean;
  month?: number;
}

export interface BorderDelayResponse {
  border: string;
  estimated_delay_hours: number;
  confidence_interval: [number, number];
  queue_length: number;
  processing_rate: number;
}

export interface FuelOptimizeRequest {
  waypoints: Array<{
    location: string;
    country: string;
    distance_from_prev_km: number;
  }>;
  vehicle: {
    fuel_tank_litres: number;
    avg_consumption_l_per_100km: number;
  };
  start_fuel_litres?: number;
}

export interface FuelOptimizeResponse {
  route_name: string;
  total_distance_km: number;
  total_fuel_consumed_l: number;
  total_cost_usd: number;
  stops: Array<{
    waypoint_index: number;
    location: string;
    country: string;
    litres_to_add: number;
    price_per_litre: number;
    cost_usd: number;
  }>;
  stops_count: number;
}

export interface ContainerMatchRequest {
  shipments: Array<{
    shipment_id: string;
    origin: string;
    destination: string;
    volume_cbm: number;
    weight_tonnes: number;
    requires_reefer?: boolean;
    latest_pickup?: string;
    value_usd?: number;
  }>;
}

export interface ContainerMatchResponse {
  shipments_count: number;
  matches: Array<{
    container_type: string;
    shipment_ids: string[];
    total_volume_cbm: number;
    total_weight_tonnes: number;
    utilization_pct: number;
    estimated_savings_usd: number;
  }>;
  matches_count: number;
}

export interface ShipmentPredictionResponse {
  shipment_id?: string;
  corridor: string;
  delay_risk: string;
  theft_risk: TheftRiskResponse;
  pricing: PricingResponse;
  nearest_border: BorderDelayResponse;
}

// ── API ────────────────────────────────────────────────────────────────────

export function createPredictionsApi(client: AxiosInstance) {
  const base = "/api/v1/predictions";

  return {
    /** Predict delay risk for a shipment given route and timing context. */
    delay: (data: DelayPredictionRequest) =>
      client.post<DelayPredictionResponse>(`${base}/delay/`, data),

    /** Forecast demand volume per corridor for N weeks ahead. */
    demand: (data: DemandForecastRequest) =>
      client.post<DemandForecastResponse>(`${base}/demand/`, data),

    /** Get a real-time freight rate recommendation. */
    pricing: (data: PricingRequest) =>
      client.post<PricingResponse>(`${base}/pricing/`, data),

    /** Assess cargo theft risk for a route/commodity/time combination. */
    theftRisk: (data: TheftRiskRequest) =>
      client.post<TheftRiskResponse>(`${base}/theft-risk/`, data),

    /** Score a single driver or batch of drivers. */
    driverScore: (data: DriverScoreRequest) =>
      client.post<DriverScoreResponse>(`${base}/driver-score/`, data),

    /** Estimate border crossing wait time. */
    borderDelay: (data: BorderDelayRequest) =>
      client.post<BorderDelayResponse>(`${base}/border-delay/`, data),

    /** Compute optimal fuel stop plan along a route. */
    fuelOptimize: (data: FuelOptimizeRequest) =>
      client.post<FuelOptimizeResponse>(`${base}/fuel-optimize/`, data),

    /** Find LCL consolidation matches for a batch of shipments. */
    containerMatch: (data: ContainerMatchRequest) =>
      client.post<ContainerMatchResponse>(`${base}/container-match/`, data),

    /** Unified endpoint: all predictions for one shipment context. */
    shipment: (data: Record<string, unknown>) =>
      client.post<ShipmentPredictionResponse>(`${base}/shipment/`, data),
  };
}

export type PredictionsApi = ReturnType<typeof createPredictionsApi>;
