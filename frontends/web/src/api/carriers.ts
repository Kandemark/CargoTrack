import apiClient from './client'
import type { PaginatedResponse } from '@/types'

export interface Carrier {
  id: number
  code: string
  name: string
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  contact_name: string
  phone: string
  email: string
  country: string
  headquarters: string
  on_time_rate: number
  rating: number
  active_shipments: number
  total_shipments: number
  high_risk_count: number
  contract_start: string | null
  contract_end: string | null
  specialties: string[]
  rate_cards: RateCard[]
  created_at: string
  updated_at: string
}

export interface RateCard {
  id: number
  carrier: number
  carrier_name: string
  name: string
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'DRAFT'
  origin: string
  destination: string
  cargo_type: string
  per_kg: string
  per_km: string
  min_charge: string
  currency: string
  is_hazmat: boolean
  is_reefer: boolean
  valid_from: string
  valid_until: string
  created_at: string
  updated_at: string
}

export const carriersApi = {
  list: (params?: { status?: string; search?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<Carrier>>('/api/v1/carriers/', { params }),

  get: (id: number) =>
    apiClient.get<Carrier>(`/api/v1/carriers/${id}/`),

  create: (data: Partial<Carrier>) =>
    apiClient.post<Carrier>('/api/v1/carriers/', data),

  update: (id: number, data: Partial<Carrier>) =>
    apiClient.patch<Carrier>(`/api/v1/carriers/${id}/`, data),

  delete: (id: number) =>
    apiClient.delete(`/api/v1/carriers/${id}/`),

  listRateCards: (params?: { status?: string; carrier?: number; search?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<RateCard>>('/api/v1/rate-cards/', { params }),

  createRateCard: (data: Partial<RateCard>) =>
    apiClient.post<RateCard>('/api/v1/rate-cards/', data),

  updateRateCard: (id: number, data: Partial<RateCard>) =>
    apiClient.patch<RateCard>(`/api/v1/rate-cards/${id}/`, data),

  deleteRateCard: (id: number) =>
    apiClient.delete(`/api/v1/rate-cards/${id}/`),
}
