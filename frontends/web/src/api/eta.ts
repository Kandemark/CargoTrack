/**
 * eta.ts — API client for real-time ETA calculation and batch fleet ETA.
 */
import apiClient from './client'

export interface ETAResult {
  tracking_number: string
  origin: string
  destination: string
  total_distance_km: number
  distance_remaining_km: number
  distance_completed_km: number
  progress_pct: number
  estimated_arrival: string | null
  estimated_remaining_hours: number
  confidence_low: string | null
  confidence_high: string | null
  current_speed_kmh: number
  current_position: { lat: number; lon: number }
  upcoming_border: string | null
  border_wait_minutes: number
  next_rest_break_at: string | null
  last_updated: string | null
}

export interface BatchETAPosition {
  tracking?: string
  origin?: string
  destination?: string
  total_distance_km?: number
  lat: number
  lon: number
  speed?: number
}

export interface BatchETAResult {
  results: Array<{
    tracking_number: string
    estimated_arrival: string | null
    estimated_remaining_hours: number
    progress_pct: number
  } | { error: string; tracking: string }>
}

export const etaApi = {
  get: (params: { tracking: string; lat: number; lon: number; speed?: number }) =>
    apiClient.get<ETAResult>('/api/v1/eta/', { params }),

  batch: (positions: BatchETAPosition[]) =>
    apiClient.post<BatchETAResult>('/api/v1/eta/batch/', { positions }),
}
