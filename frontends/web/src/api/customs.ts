/**
 * customs.ts — API client for customs declarations, tariff lookup, and border info.
 */
import apiClient from './client'

export interface CustomsDeclaration {
  declaration_id: string
  status: string
  customs_system: string
  customs_office: string | null
  external_ref: string
}

export interface BorderCrossing {
  name: string
  customs_system: string
  office_code: string
}

export interface CustomsSystem {
  code: string
  country: string
  description: string
}

export interface BorderCrossingsResponse {
  border_crossings: BorderCrossing[]
  customs_systems: CustomsSystem[]
}

export const customsApi = {
  declare: (data: Record<string, unknown>) =>
    apiClient.post<CustomsDeclaration>('/api/v1/customs/declare/', data),

  getStatus: (params: { id: string; system: string }) =>
    apiClient.get<Record<string, unknown>>('/api/v1/customs/status/', { params }),

  lookupTariff: (hsCode: string, country: string) =>
    apiClient.get<Record<string, unknown>>('/api/v1/customs/tariff/', { params: { hs: hsCode, country } }),

  getBorders: () =>
    apiClient.get<BorderCrossingsResponse>('/api/v1/customs/borders/'),
}
