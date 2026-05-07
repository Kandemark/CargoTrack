import apiClient from './client'

export interface ComplianceDoc {
  id: number
  shipment: number
  tracking_number: string
  doc_type: string
  doc_type_display: string
  reference: string
  issued_by: string
  issued_date: string | null
  expiry_date: string | null
  days_until_expiry: number | null
  is_required: boolean
  status: 'VALID' | 'EXPIRED' | 'EXPIRING' | 'MISSING' | 'PENDING'
  status_display: string
  notes: string
  created_at: string
  updated_at: string
}

export const complianceApi = {
  list: (params?: { status?: string; page?: number; page_size?: number }) =>
    apiClient.get<{ results: ComplianceDoc[]; count: number }>('/api/v1/compliance/', { params }),

  get: (id: number) =>
    apiClient.get<ComplianceDoc>(`/api/v1/compliance/${id}/`),

  create: (data: Partial<ComplianceDoc>) =>
    apiClient.post<ComplianceDoc>('/api/v1/compliance/', data),

  update: (id: number, data: Partial<ComplianceDoc>) =>
    apiClient.patch<ComplianceDoc>(`/api/v1/compliance/${id}/`, data),

  delete: (id: number) =>
    apiClient.delete(`/api/v1/compliance/${id}/`),

  forShipment: (shipmentId: number) =>
    apiClient.get<ComplianceDoc[]>(`/api/v1/shipments/${shipmentId}/compliance/`),
}
