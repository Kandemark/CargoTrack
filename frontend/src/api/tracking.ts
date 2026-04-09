import { apiClient } from './client'
import type { TrackingEvent } from '@shared/api/types'

// Tracking events via the versioned shipments endpoint
export const trackingApi = {
  getEvents: (shipmentId: number) =>
    apiClient.get<TrackingEvent[]>(`/v1/shipments/${shipmentId}/tracking-events/`),

  addEvent: (shipmentId: number, data: Partial<TrackingEvent>) =>
    apiClient.post<TrackingEvent>(`/v1/shipments/${shipmentId}/tracking-events/`, data),
}
