/**
 * demurrage.ts — API client for demurrage & detention fee calculation.
 */
import apiClient from './client'

export interface DemurrageDailyBreakdown {
  day: number
  date: string
  daily_rate_usd: string
  running_total_usd: string
}

export interface DemurrageResult {
  port_code: string
  container_type: string
  shipment_type: string
  arrival_date: string
  free_days: number
  free_days_expiry: string
  return_date: string
  chargeable_days: number
  total_demurrage_usd: string
  total_detention_usd: string
  grand_total_usd: string
  status: 'WITHIN_FREE_PERIOD' | 'ACCRUING' | 'FINAL'
  daily_breakdown: DemurrageDailyBreakdown[]
  attribution: string | null
}

export interface PortContainer extends DemurrageResult {
  container_number: string
  tracking_number: string
}

export interface PortStatus {
  port: string
  free_days_config: Record<string, number>
  containers: PortContainer[]
  total_containers: number
  total_demurrage_accruing_usd: string
}

export const demurrageApi = {
  calculate: (params: {
    port: string
    container_type: string
    type: string
    arrival: string
    return: string
  }) =>
    apiClient.get<DemurrageResult>('/api/v1/demurrage/', { params }),

  portStatus: (port: string) =>
    apiClient.get<PortStatus>('/api/v1/demurrage/port/', { params: { port } }),
}
