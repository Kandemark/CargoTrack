// Types for the React Native native module bridge (Kotlin/Swift → JS)
// These mirror the interfaces used by CargoTrackNative.ts in the mobile app.

export interface Shipment {
  id: string
  trackingNumber: string
  status: string
  origin: string
  destination: string
  carrierName?: string
  estimatedArrival?: string
  lastUpdated: number
}

export interface TrackingEventInput {
  id?: string
  shipmentId: string
  eventType: string
  location: string
  notes?: string
  timestamp: number
}
