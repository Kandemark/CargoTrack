/**
 * shared/api/types.ts — Canonical domain types for CargoTrack
 * =============================================================
 *
 * This is the **single source of truth** for all TypeScript types shared
 * between the React web frontend (`frontend/`) and the Expo mobile app
 * (`mobile/`).  Both platforms import from `@shared/api/types` via the
 * path alias configured in their respective tsconfig.json files.
 *
 * Design rules:
 *   - All string enums (status, role, severity, event_type) use the same
 *     uppercase values stored in the Django database — no mapping needed.
 *   - Nullable fields use `T | null` (not `T | undefined`) to match JSON.
 *   - Timestamps are ISO-8601 strings (UTC) as returned by DRF.
 *
 * @module shared/api/types
 */

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  username: string
  first_name: string
  last_name: string
  role: 'ADMIN' | 'LOGISTICS_MGR' | 'CLIENT' | 'CARRIER'
  company: string
  phone: string
}

export interface TokenPair {
  access: string
  refresh: string
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export interface Route {
  id: number
  origin: string
  destination: string
  distance_km: number
  estimated_hours: number
}

// ─── Shipments ────────────────────────────────────────────────────────────────

export type ShipmentStatus =
  | 'PENDING'
  | 'IN_TRANSIT'
  | 'CUSTOMS'
  | 'DELIVERED'
  | 'DELAYED'

export interface Shipment {
  id: number
  tracking_number: string
  route: Route
  status: ShipmentStatus
  status_display: string
  carrier_name: string
  weight_kg: number
  scheduled_departure: string
  scheduled_arrival: string
  actual_departure: string | null
  actual_arrival: string | null
  delay_risk_score: number
  created_at: string
  updated_at: string
}

export interface ShipmentListItem {
  id: number
  tracking_number: string
  route: Route
  status: ShipmentStatus
  status_display: string
  carrier_name: string
  weight_kg: number
  scheduled_departure: string
  scheduled_arrival: string
  delay_risk_score: number
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

export type EventType =
  | 'DEPARTURE'
  | 'CHECKPOINT'
  | 'CUSTOMS_ENTRY'
  | 'CUSTOMS_CLEAR'
  | 'ARRIVAL'
  | 'DELAY'
  | 'NOTE'

export interface TrackingEvent {
  id: number
  shipment: number
  event_type: EventType
  event_type_display: string
  location: string
  timestamp: string
  notes: string
  recorded_by: number | null
  recorded_by_name: string | null
}

// ─── Delay Predictions ────────────────────────────────────────────────────────

export interface DelayPrediction {
  shipment_id: number
  tracking_number: string
  delay_risk_score: number
  predicted_delayed: boolean
  confidence: number
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Alert {
  id: number
  shipment: number
  shipment_tracking: string
  message: string
  risk_score: number
  severity: AlertSeverity
  severity_display: string
  sent_at: string
  acknowledged: boolean
}

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_shipments: number
  active_shipments: number
  delivered_shipments: number
  delayed_shipments: number
  on_time_rate: number
  exception_count: number
  carrier_count: number
  open_alerts: number
}

export interface CarrierPerformance {
  carrier_name: string
  shipment_count: number
  avg_risk: number
  on_time: number
}

// ─── Role constants ───────────────────────────────────────────────────────────

export const UserRole = {
  ADMIN:         'ADMIN',
  LOGISTICS_MGR: 'LOGISTICS_MGR',
  CLIENT:        'CLIENT',
  CARRIER:       'CARRIER',
} as const

export type UserRoleType = typeof UserRole[keyof typeof UserRole]

export interface DashboardResponse {
  summary: DashboardSummary
  recent_events: TrackingEvent[]
  carrier_performance: CarrierPerformance[]
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
