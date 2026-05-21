/**
 * coldchain.ts — API client for cold chain monitoring and compliance.
 */
import apiClient from './client'

export interface TemperatureReading {
  id: number
  device_id: string
  timestamp: string
  temperature_c: number
  humidity_pct: number | null
  battery_level: number | null
  location_lat: number | null
  location_lng: number | null
  signal_strength: number | null
}

export interface TemperatureExcursion {
  id: number
  coldchain_shipment: number
  started_at: string
  resolved_at: string | null
  duration_minutes: number | null
  peak_temp_c: number | null
  min_temp_c: number | null
  severity: 'WARNING' | 'BREACH' | 'CRITICAL' | 'SPOILAGE_ALERT'
  temp_limit_breached: 'OVER_MAX' | 'UNDER_MIN'
  acknowledged_by: number | null
  acknowledged_at: string | null
  resolution_notes: string
  created_at: string
}

export interface ColdChainCertificate {
  id: number
  coldchain_shipment: number
  issued_at: string
  total_readings: number
  excursions_count: number
  total_excursion_minutes: number
  min_temp_recorded_c: number
  max_temp_recorded_c: number
  avg_temp_c: number
  is_compliant: boolean
  pdf_report: string | null
}

export interface ColdChainShipment {
  id: number
  shipment: number
  product_type: string
  temp_min_c: number
  temp_max_c: number
  humidity_min_pct: number | null
  humidity_max_pct: number | null
  tolerance_minutes: number
  requires_continuous_monitoring: boolean
  monitoring_device_id: string
  notes: string
  recent_readings: TemperatureReading[]
  active_excursion: TemperatureExcursion | null
  certificate: ColdChainCertificate | null
  created_at: string
}

export interface ComplianceReport {
  tracking_number: string
  product_type: string
  temp_range: { min_c: number; max_c: number }
  tolerance_minutes: number
  monitoring_period_hours: number
  total_readings: number
  compliance_pct: number
  temperature_stats: { min_c: number; max_c: number; avg_c: number; stddev_c: number }
  excursions: { total: number; total_minutes: number; by_severity: Record<string, number> }
  sla: { is_breached: boolean; max_excursion_minutes: number | null } | null
  certificate: ColdChainCertificate | null
}

export const coldchainApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<{ count: number; results: ColdChainShipment[] }>('/api/v1/coldchain/coldchain/', { params }),

  get: (id: number) =>
    apiClient.get<ColdChainShipment>(`/api/v1/coldchain/coldchain/${id}/`),

  create: (data: Partial<ColdChainShipment>) =>
    apiClient.post<ColdChainShipment>('/api/v1/coldchain/coldchain/', data),

  complianceReport: (id: number) =>
    apiClient.get<ComplianceReport>(`/api/v1/coldchain/coldchain/${id}/compliance-report/`),

  getReadings: (params?: Record<string, string>) =>
    apiClient.get<{ count: number; results: TemperatureReading[] }>('/api/v1/coldchain/temperature-readings/', { params }),

  createReadings: (readings: Partial<TemperatureReading>[]) =>
    apiClient.post<TemperatureReading[]>('/api/v1/coldchain/temperature-readings/', readings),

  complianceDashboard: () =>
    apiClient.get<{ shipments: ColdChainShipment[]; active_excursions: TemperatureExcursion[] }>('/api/v1/coldchain/compliance-dashboard/'),
}
