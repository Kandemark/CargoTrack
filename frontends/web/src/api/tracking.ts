/**
 * frontend/src/api/tracking.ts
 *
 * API functions for tracking events.  Prefer the shipment-scoped sub-resource
 * endpoints (in shipmentsApi) for creating events against a known shipment PK.
 * Use these functions for cross-shipment event searches and legacy lookups.
 *
 * Endpoint coverage:
 *   GET  /api/v1/tracking/events/                  — paginated event list
 *   POST /api/v1/tracking/events/                  — create a standalone event
 *   GET  /api/v1/tracking/<tracking_number>/events/ — legacy: events by number
 */
import apiClient from './client'
import type { TrackingEvent, PaginatedResponse } from '@/types'

export const trackingApi = {
  /**
   * GET /api/v1/tracking/events/
   * List all tracking events. Filter by tracking number via ?tracking_number=CT-XXX.
   */
  getTrackingEvents: (params?: { tracking_number?: string; page?: number }) =>
    apiClient.get<PaginatedResponse<TrackingEvent>>('/api/v1/tracking/events/', { params }),

  /**
   * POST /api/v1/tracking/events/
   * Log a new tracking event.
   */
  createTrackingEvent: (data: {
    shipment: number
    event_type: string
    location: string
    notes?: string
  }) => apiClient.post<TrackingEvent>('/api/v1/tracking/events/', data),

  /**
   * GET /api/v1/tracking/<tracking_number>/events/
   * Return all events for a shipment identified by tracking number.
   * Response is a plain array (uses model.to_dict()).
   */
  getEventsByTrackingNumber: (trackingNumber: string) =>
    apiClient.get<Pick<TrackingEvent, 'id' | 'shipment' | 'event_type' | 'location' | 'notes' | 'timestamp' | 'recorded_by'>[]>(
      `/api/v1/tracking/${encodeURIComponent(trackingNumber.toUpperCase())}/events/`,
    ),
}
