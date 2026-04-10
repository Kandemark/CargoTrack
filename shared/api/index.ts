/**
 * shared/api/index.ts
 * Central re-export for all shared API modules.
 * Import from here when you want everything, or import specific modules
 * (e.g. @shared/api/types) to keep bundle sizes small.
 */
export { createApiClient }      from './client'
export type { ApiClientConfig } from './client'

export { createAuthApi }        from './auth'
export { createShipmentsApi }   from './shipments'
export { createDashboardApi }   from './dashboard'

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
} from './types'
