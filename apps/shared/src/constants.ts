// ── Shared constants for both web and mobile apps ──

export const BRAND = {
  name: 'CargoTrack',
  tagline: 'East Africa Freight Intelligence',
  primary: '#f5801e',
  navy: '#0f2d5e',
} as const

export const API = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  timeout: 15_000,
} as const

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  IN_TRANSIT: 'In Transit',
  CUSTOMS: 'Customs Clearance',
  DELAYED: 'Delayed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export const SHIPMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: '#6b7280',
  IN_TRANSIT: '#3b82f6',
  CUSTOMS: '#a855f7',
  DELAYED: '#ef4444',
  DELIVERED: '#22c55e',
  CANCELLED: '#9ca3af',
}

export const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  CARRIER: 'Carrier / Driver',
  LOGISTICS_MGR: 'Logistics Manager',
  ADMIN: 'Administrator',
  DISPATCHER: 'Dispatcher',
  CUSTOMS_BROKER: 'Customs Broker',
  WAREHOUSE_MGR: 'Warehouse Manager',
  PORT_AGENT: 'Port Agent',
  FINANCE_OFFICER: 'Finance Officer',
}
