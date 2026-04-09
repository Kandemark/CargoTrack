/**
 * Re-export canonical types from shared/ so the frontend imports
 * from a single location. The shared types use Django's uppercase
 * status codes (PENDING, IN_TRANSIT, etc.).
 */
export type {
  User,
  TokenPair,
  Route,
  Shipment,
  ShipmentListItem,
  ShipmentStatus,
  EventType,
  TrackingEvent,
  DelayPrediction,
  AlertSeverity,
  Alert,
  DashboardSummary,
  CarrierPerformance,
  DashboardResponse,
  PaginatedResponse,
} from '@shared/api/types'
