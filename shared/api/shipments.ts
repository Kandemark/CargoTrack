/**
 * shared/api/shipments.ts — Shipments API factory
 * =================================================
 *
 * Returns a shipments API object bound to the provided Axios instance.
 * Used by both the React web app (`frontend/src/api/shipments.ts` wraps its
 * own client) and the Expo mobile app (`mobile/lib/api.ts` calls
 * `createShipmentsApi(apiClient)` directly).
 *
 * Endpoint coverage:
 *   GET  /api/v1/shipments/                          — paginated list
 *   GET  /api/v1/shipments/<id>/                     — full detail
 *   POST /api/v1/shipments/                          — create
 *   PATCH /api/v1/shipments/<id>/                    — status update only
 *   POST /api/v1/shipments/<id>/predict/             — ML delay prediction
 *   GET  /api/v1/shipments/<id>/tracking-events/     — events for a shipment
 *   POST /api/v1/shipments/<id>/tracking-events/     — log a new event
 */
import type { AxiosInstance } from 'axios'
import type { Shipment, ShipmentListItem, TrackingEvent, PaginatedResponse, DelayPrediction } from './types'

export function createShipmentsApi(client: AxiosInstance) {
  return {
    /** GET /api/v1/shipments/ — paginated list. */
    list: (params?: { page?: number; page_size?: number; status?: string; search?: string }) =>
      client.get<PaginatedResponse<ShipmentListItem>>('/api/v1/shipments/', { params }),

    /** GET /api/v1/shipments/<pk>/ — full detail. */
    get: (id: number) =>
      client.get<Shipment>(`/api/v1/shipments/${id}/`),

    /** POST /api/v1/shipments/ — create a new shipment. */
    create: (data: Partial<Shipment>) =>
      client.post<Shipment>('/api/v1/shipments/', data),

    /** PATCH /api/v1/shipments/<pk>/ — update status field only. */
    updateStatus: (id: number, status: string) =>
      client.patch<Shipment>(`/api/v1/shipments/${id}/`, { status }),

    /** POST /api/v1/shipments/<pk>/predict/ — run ML delay prediction. */
    predict: (id: number) =>
      client.post<DelayPrediction>(`/api/v1/shipments/${id}/predict/`, {}),

    /** GET /api/v1/shipments/<pk>/tracking-events/ — paginated events. */
    trackingEvents: (id: number, params?: { page?: number }) =>
      client.get<PaginatedResponse<TrackingEvent>>(
        `/api/v1/shipments/${id}/tracking-events/`,
        { params },
      ),

    /** POST /api/v1/shipments/<pk>/tracking-events/ — log a new event. */
    logEvent: (
      id: number,
      data: { event_type: string; location: string; notes?: string },
    ) =>
      client.post<TrackingEvent>(`/api/v1/shipments/${id}/tracking-events/`, data),
  }
}
