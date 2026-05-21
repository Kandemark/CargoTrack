/**
 * pod.ts — API client for Proof of Delivery, verification, and disputes.
 */
import apiClient from './client'

export interface PODPhoto {
  id: number
  image: string
  photo_type: 'PACKAGE' | 'DAMAGE' | 'LOCATION' | 'SIGNATURE' | 'ID_CARD' | 'OTHER'
  caption: string
  taken_at: string | null
  location_lat: number | null
  location_lng: number | null
}

export interface PODDispute {
  id: number
  pod: number
  dispute_reason: string
  description: string
  raised_by: number | null
  raised_by_name: string | null
  raised_at: string
  resolution_status: string
  assigned_to: number | null
  assigned_to_name: string | null
  resolution_notes: string
  resolution_amount: string | null
  resolved_at: string | null
  updated_at: string
}

export interface ProofOfDelivery {
  id: number
  shipment: number
  tracking_number: string | null
  verification_code: string
  verification_url: string
  delivered_at: string
  received_by_name: string
  received_by_phone: string
  received_by_signature: string
  location_lat: number | null
  location_lng: number | null
  condition: 'GOOD' | 'DAMAGED' | 'SHORT' | 'REFUSED'
  verification_status: 'UNVERIFIED' | 'VERIFIED' | 'DISPUTED'
  verified_by: number | null
  verified_at: string | null
  notes: string
  captured_by: number | null
  photos: PODPhoto[]
  dispute: PODDispute | null
  created_at: string
}

export interface PODVerifyByCode {
  tracking_number: string
  delivered_at: string
  received_by_name: string
  condition: string
  verification_status: string
  location: { lat: number | null; lng: number | null }
  photos: PODPhoto[]
}

export const podApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<{ count: number; results: ProofOfDelivery[] }>('/api/v1/pod/pod/', { params }),

  get: (id: number) =>
    apiClient.get<ProofOfDelivery>(`/api/v1/pod/pod/${id}/`),

  create: (data: Partial<ProofOfDelivery>) =>
    apiClient.post<ProofOfDelivery>('/api/v1/pod/pod/', data),

  uploadPhoto: (podId: number, formData: FormData) =>
    apiClient.post<PODPhoto>(`/api/v1/pod/pod/${podId}/upload_photo/`, formData),

  verify: (podId: number) =>
    apiClient.post<ProofOfDelivery>(`/api/v1/pod/pod/${podId}/verify/`),

  raiseDispute: (podId: number, data: { dispute_reason: string; description: string }) =>
    apiClient.post<PODDispute>(`/api/v1/pod/pod/${podId}/raise_dispute/`, data),

  resolveDispute: (podId: number, data: { resolution_status: string; resolution_notes?: string; resolution_amount?: number }) =>
    apiClient.post<PODDispute>(`/api/v1/pod/pod/${podId}/resolve_dispute/`, data),

  listDisputes: (params?: Record<string, string>) =>
    apiClient.get<{ count: number; results: PODDispute[] }>('/api/v1/pod/disputes/', { params }),

  verifyByCode: (code: string) =>
    apiClient.get<PODVerifyByCode>('/api/v1/pod/pod/verify-by-code/', { params: { code } }),
}
