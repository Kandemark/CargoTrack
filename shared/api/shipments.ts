import type { AxiosInstance } from 'axios'
import type { Shipment, ShipmentListItem, PaginatedResponse, DelayPrediction } from './types'

export function createShipmentsApi(client: AxiosInstance) {
  return {
    list: (params?: { page?: number; page_size?: number; status?: string; search?: string }) =>
      client.get<PaginatedResponse<ShipmentListItem>>('/api/v1/shipments/', { params }),

    get: (id: number) =>
      client.get<Shipment>(`/api/v1/shipments/${id}/`),

    create: (data: Partial<Shipment>) =>
      client.post<Shipment>('/api/v1/shipments/', data),

    updateStatus: (id: number, status: string) =>
      client.patch<Shipment>(`/api/v1/shipments/${id}/`, { status }),

    predict: (id: number) =>
      client.post<DelayPrediction>(`/api/v1/shipments/${id}/predict/`, {}),

    trackingEvents: (id: number) =>
      client.get(`/api/v1/shipments/${id}/tracking-events/`),
  }
}
