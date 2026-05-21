/**
 * frontend/src/api/shipments.ts
 *
 * API functions for the shipments domain.  All functions use the shared
 * {@link apiClient} Axios instance which attaches the JWT Bearer token and
 * handles 401 → silent refresh automatically.
 *
 * Endpoint coverage:
 *   GET  /api/v1/routes/                              — unpaginated route list
 *   GET  /api/v1/shipments/                           — paginated shipment list
 *   GET  /api/v1/shipments/<id>/                      — single shipment detail
 *   POST /api/v1/shipments/                           — create shipment
 *   PATCH /api/v1/shipments/<id>/                     — update status
 *   GET  /api/v1/shipments/<id>/tracking-events/      — events for a shipment
 *   POST /api/v1/shipments/<id>/tracking-events/      — log a new event
 *   POST /api/v1/shipments/<id>/predict/              — run ML delay prediction
 */
import apiClient from './client'
import type { Route, Shipment, ShipmentListItem, TrackingEvent, DelayPrediction, PaginatedResponse } from '@/types'

export const shipmentsApi = {
  /** GET /api/v1/routes/ — unpaginated list of all routes (for dropdowns). */
  getRoutes: () =>
    apiClient.get<Route[]>('/api/v1/routes/'),

  /** GET /api/v1/shipments/ — paginated shipment list. */
  getShipments: (params?: { page?: number; page_size?: number; status?: string }) =>
    apiClient.get<PaginatedResponse<ShipmentListItem>>('/api/v1/shipments/', { params }),

  /** GET /api/v1/shipments/<pk>/ — full shipment detail. */
  getShipment: (id: number) =>
    apiClient.get<Shipment>(`/api/v1/shipments/${id}/`),

  /** POST /api/v1/shipments/ — create a new shipment. */
  createShipment: (data: {
    route: number
    carrier_name: string
    weight_kg: number
    scheduled_departure: string
    scheduled_arrival: string
  }) => apiClient.post<Shipment>('/api/v1/shipments/', data),

  /** PATCH /api/v1/shipments/<pk>/ — update status only. */
  updateShipmentStatus: (id: number, status: string) =>
    apiClient.patch<Shipment>(`/api/v1/shipments/${id}/`, { status }),

  /** GET /api/v1/shipments/<pk>/tracking-events/ — all events for a shipment. */
  getShipmentTrackingEvents: (id: number, params?: { page?: number }) =>
    apiClient.get<PaginatedResponse<TrackingEvent>>(
      `/api/v1/shipments/${id}/tracking-events/`,
      { params },
    ),

  /** POST /api/v1/shipments/<pk>/tracking-events/ — log a new event. */
  createTrackingEvent: (
    id: number,
    data: { event_type: string; location: string; notes: string },
  ) =>
    apiClient.post<TrackingEvent>(`/api/v1/shipments/${id}/tracking-events/`, data),

  /** POST /api/v1/shipments/<pk>/predict/ — run ML delay prediction. */
  predictDelay: (id: number) =>
    apiClient.post<DelayPrediction>(`/api/v1/shipments/${id}/predict/`, {}),
}
