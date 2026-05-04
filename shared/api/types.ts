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

export type UserRole =
  | 'ADMIN' | 'LOGISTICS_MGR' | 'CLIENT' | 'CARRIER'
  | 'DISPATCHER' | 'CUSTOMS_BROKER' | 'WAREHOUSE_MGR'
  | 'PORT_AGENT' | 'FINANCE_OFFICER'

export interface User {
  id: number
  email: string
  username: string
  first_name: string
  last_name: string
  role: UserRole
  role_display: string
  org_id: number | null
  org_name: string | null
  phone: string
  onboarding_completed: boolean
  date_joined: string
  last_login: string | null
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
  total_revenue_mtd?: number
  total_cost_mtd?: number
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

// ─── Payments ─────────────────────────────────────────────────────────────────

export type InvoiceStatus   = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
export type PaymentProvider = 'MPESA' | 'AIRTEL' | 'MTN' | 'FLUTTERWAVE' | 'STRIPE' | 'PESAPAL'
export type PaymentStatus   = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
export type Currency        = 'KES' | 'USD' | 'UGX' | 'RWF' | 'TZS'

export interface Payment {
  id:                 number
  provider:           PaymentProvider
  provider_reference: string
  amount:             string
  currency:           Currency
  status:             PaymentStatus
  phone_number:       string
  created_at:         string
  updated_at:         string
}

export interface Invoice {
  id:                number
  invoice_number:    string
  shipment:          number
  shipment_tracking: string
  amount_kes:        string
  currency:          Currency
  status:            InvoiceStatus
  status_display:    string
  description:       string
  created_at:        string
  paid_at:           string | null
  payments:          Payment[]
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocType = 'BOL' | 'CUSTOMS' | 'PACKING' | 'INSURANCE' | 'OTHER'

export interface Document {
  id:               number
  shipment:         number
  file:             string
  file_url:         string | null
  doc_type:         DocType
  doc_type_display: string
  filename:         string
  uploaded_by:      number | null
  uploaded_by_name: string | null
  created_at:       string
}

// ─── Landing Page ──────────────────────────────────────────────────────────────

export interface MapDot {
  lat: number
  lng: number
  status: string
}

export interface PublicLandingStats {
  active_shipments: number
  total_shipments: number
  active_carriers: number
  active_trucks: number
  on_time_rate: number
  total_tonnes: number
  delay_rate: number
  avg_driver_rating: number
  total_deliveries: number
  map_dots: MapDot[]
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ─── Chat ──────────────────────────────────────────────────────────────────────

export interface ConversationParticipant {
  id: number
  first_name: string
  last_name: string
  username: string
  role: string
}

export interface LastMessage {
  id: number
  content: string
  sender_name: string
  created_at: string
  is_read: boolean
}

export interface Conversation {
  id: number
  subject: string
  shipment: number | null
  is_group: boolean
  participants: number[]
  participants_display: string
  last_message: LastMessage | null
  unread_count: number
  created_at: string
  updated_at: string
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[]
}

export interface ChatMessage {
  id: number
  conversation: number
  sender: number | null
  sender_id: number | null
  sender_name: string
  sender_role: string
  content: string
  attachment_url: string
  is_read: boolean
  is_system: boolean
  created_at: string
}

export interface TypingEvent {
  conversation_id: number
  user_id: number
  user_name: string
}

export interface ReadReceipt {
  conversation_id: number
  reader_id: number
}

// ─── Marketplace ────────────────────────────────────────────────────────────────

export type CargoType =
  | 'GENERAL' | 'PERISHABLE' | 'HAZARDOUS' | 'FRAGILE'
  | 'BULK' | 'CONTAINER' | 'LIQUID' | 'VEHICLES' | 'LIVESTOCK' | 'OTHER'

export type ListingStatus =
  | 'OPEN' | 'IN_PROGRESS' | 'AWARDED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'

export type BidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'

export interface TruckInfo {
  id: number
  fleet_id: string
  plate: string
}

export interface Bid {
  id: number
  listing: number
  carrier: number
  carrier_name: string
  truck: number | null
  truck_info: TruckInfo | null
  driver: number | null
  driver_name: string | null
  amount: string
  notes: string
  status: BidStatus
  estimated_days: number | null
  created_at: string
  updated_at: string
}

export interface FreightListing {
  id: number
  posted_by: number
  posted_by_name: string
  cargo_type: CargoType
  cargo_type_display: string
  weight_kg: number
  volume_m3: number | null
  origin: string
  destination: string
  pickup_date: string
  delivery_date: string
  budget_min: string | null
  budget_max: string | null
  description: string
  requires_hazmat: boolean
  requires_reefer: boolean
  status: ListingStatus
  bid_count: number
  lowest_bid: number | null
  bids: Bid[]
  awarded_shipment: number | null
  created_at: string
  updated_at: string
  expires_at: string | null
}

export interface FreightListingCreatePayload {
  cargo_type: string
  weight_kg: number
  volume_m3?: number | null
  origin: string
  destination: string
  pickup_date: string
  delivery_date: string
  budget_min?: string | null
  budget_max?: string | null
  description?: string
  requires_hazmat?: boolean
  requires_reefer?: boolean
  expires_at?: string | null
}

export interface BidCreatePayload {
  listing: number
  amount: string
  truck?: number | null
  driver?: number | null
  notes?: string
  estimated_days?: number | null
}
