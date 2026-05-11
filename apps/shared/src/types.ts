// ── Shared types used by both web (Vite/React) and mobile (Expo/React Native) ──

export type UserRole =
  | 'CLIENT'
  | 'CARRIER'
  | 'LOGISTICS_MGR'
  | 'ADMIN'
  | 'DISPATCHER'
  | 'CUSTOMS_BROKER'
  | 'WAREHOUSE_MGR'
  | 'PORT_AGENT'
  | 'FINANCE_OFFICER'

export type ShipmentStatus =
  | 'PENDING'
  | 'IN_TRANSIT'
  | 'CUSTOMS'
  | 'DELAYED'
  | 'DELIVERED'
  | 'CANCELLED'

export interface TrackEvent {
  id: string
  shipment: string
  event_type: string
  location_label: string
  location_lat: number | null
  location_lng: number | null
  notes: string
  recorded_at: string
  recorded_by_name: string
  recorded_by_role: UserRole
}

export interface Shipment {
  id: string
  tracking_number: string
  status: ShipmentStatus
  status_display: string
  origin: string
  destination: string
  carrier_name: string
  driver_name: string
  weight_kg: number
  cargo_description: string
  scheduled_departure: string | null
  estimated_arrival: string | null
  actual_departure: string | null
  actual_arrival: string | null
  delay_risk_score: number | null
  latest_event: TrackEvent | null
  created_at: string
}

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: UserRole
  organization_id: number | null
  organization_name: string | null
}
