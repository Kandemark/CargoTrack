/**
 * frontend/src/api/payments.ts — Invoice & payment API calls.
 */
import apiClient from './client'
import type { Invoice, PaginatedResponse, PaymentProvider } from '@/types'

export const paymentsApi = {
  /** GET /api/v1/invoices/ */
  listInvoices: (params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<Invoice>>('/api/v1/invoices/', { params }),

  /** GET /api/v1/invoices/<pk>/ */
  getInvoice: (id: number) =>
    apiClient.get<Invoice>(`/api/v1/invoices/${id}/`),

  /** POST /api/v1/invoices/ */
  createInvoice: (data: { shipment: number; amount_kes: string; currency: string; description?: string }) =>
    apiClient.post<Invoice>('/api/v1/invoices/', data),

  /** POST /api/v1/invoices/<pk>/pay/ */
  payInvoice: (id: number, payload: { provider: PaymentProvider; phone_number?: string; card_token?: string }) =>
    apiClient.post<{
      success: boolean
      provider: string
      reference: string
      data: Record<string, unknown>
    }>(`/api/v1/invoices/${id}/pay/`, payload),

  /** GET /api/v1/invoices/<pk>/pdf/ */
  getPdfUrl: (id: number) => `/api/v1/invoices/${id}/pdf/`,
}

export const documentsApi = {
  /** GET /api/v1/shipments/<pk>/documents/ */
  listDocuments: (shipmentId: number) =>
    apiClient.get(`/api/v1/shipments/${shipmentId}/documents/`),

  /** POST /api/v1/shipments/<pk>/documents/ (multipart) */
  uploadDocument: (shipmentId: number, formData: FormData) =>
    apiClient.post(`/api/v1/shipments/${shipmentId}/documents/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}
