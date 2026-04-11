/**
 * frontend/src/types/index.ts
 *
 * Single import surface for all CargoTrack TypeScript types.
 *
 * All canonical domain types (User, Shipment, Alert, …) are re-exported from
 * `shared/api/types.ts` so both the React web app and the Expo mobile app use
 * the same definitions. Django's status and role values are uppercase strings
 * (e.g. `'PENDING'`, `'ADMIN'`) matching the database choices.
 *
 * `UserRole` is defined locally (not re-exported from @shared) to satisfy
 * TypeScript's `verbatimModuleSyntax` rule: re-exporting a const object from
 * an `@shared` module would require a full JS module resolution, which fails
 * inside the Vite/tsc build when @shared resolves via the path alias.
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
  InvoiceStatus,
  PaymentProvider,
  PaymentStatus,
  Currency,
  Payment,
  Invoice,
  DocType,
  Document,
} from '@shared/api/types'

// Defined locally to keep this as a pure type-only re-export file and avoid
// forcing tsc to resolve @shared as a JS module (verbatimModuleSyntax constraint).
export const UserRole = {
  ADMIN:         'ADMIN',
  LOGISTICS_MGR: 'LOGISTICS_MGR',
  CLIENT:        'CLIENT',
  CARRIER:       'CARRIER',
} as const

export type UserRoleType = typeof UserRole[keyof typeof UserRole]
