/**
 * frontend/src/api/fleet.ts — Fleet management API calls.
 */
import apiClient from './client'
import type { PaginatedResponse } from '@/types'

export interface Truck {
  id: number
  fleet_id: string
  make: string
  model: string
  year: number
  plate: string
  vin: string
  color: string
  payload_tonnes: number
  engine_cc: number
  fuel_type: string
  fuel_capacity_l: number
  status: 'ACTIVE' | 'IDLE' | 'MAINTENANCE' | 'OFF_DUTY' | 'DECOMMISSIONED'
  odometer_km: number
  load_pct: number
  current_location: string
  latitude: number | null
  longitude: number | null
  last_service_date: string | null
  next_service_date: string | null
  next_service_km: number | null
  assigned_driver: number | null
  assigned_driver_name: string | null
  maintenance_logs: MaintenanceLog[]
  created_at: string
  updated_at: string
}

export interface MaintenanceLog {
  id: number
  truck: number
  log_type: string
  description: string
  cost_kes: string
  odometer_km: number
  performed_by: string
  performed_at: string
  created_at: string
}

export interface Driver {
  id: number
  driver_id: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  email: string
  avatar_url: string
  license_number: string
  license_class: string
  license_expiry: string | null
  status: 'AVAILABLE' | 'ON_ROUTE' | 'OFF_DUTY' | 'ON_LEAVE' | 'SUSPENDED'
  date_joined: string | null
  years_experience: number
  rating: number
  on_time_rate: number
  total_jobs: number
  total_km: number
  earnings_mtd: string
  active_route: string
  current_location: string
  latitude: number | null
  longitude: number | null
  certifications: string[]
  job_history: DriverJob[]
  truck_info: { fleet_id: string; plate: string } | null
  created_at: string
  updated_at: string
}

export interface DriverJob {
  id: number
  driver: number
  shipment: number | null
  route_label: string
  distance_km: number
  status: string
  on_time: boolean
  earnings_kes: string
  completed_at: string | null
  created_at: string
}

export interface TruckStats {
  total: number
  active: number
  idle: number
  maintenance: number
  off_duty: number
}

export interface DriverStats {
  total: number
  available: number
  on_route: number
  off_duty: number
  on_leave: number
  avg_rating: number
  avg_on_time: number
}

export interface FleetStats {
  trucks: number
  trucks_active: number
  drivers: number
  drivers_on_route: number
  fleet_utilisation: number
}

export const fleetApi = {
  listTrucks: (params?: { status?: string; q?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<Truck>>('/api/v1/fleet/trucks/', { params }),

  getTruck: (id: number) =>
    apiClient.get<Truck>(`/api/v1/fleet/trucks/${id}/`),

  createTruck: (data: Partial<Truck>) =>
    apiClient.post<Truck>('/api/v1/fleet/trucks/', data),

  updateTruck: (id: number, data: Partial<Truck>) =>
    apiClient.patch<Truck>(`/api/v1/fleet/trucks/${id}/`, data),

  truckStats: () =>
    apiClient.get<TruckStats>('/api/v1/fleet/trucks/stats/'),

  listDrivers: (params?: { status?: string; q?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<Driver>>('/api/v1/fleet/drivers/', { params }),

  getDriver: (id: number) =>
    apiClient.get<Driver>(`/api/v1/fleet/drivers/${id}/`),

  createDriver: (data: Partial<Driver>) =>
    apiClient.post<Driver>('/api/v1/fleet/drivers/', data),

  updateDriver: (id: number, data: Partial<Driver>) =>
    apiClient.patch<Driver>(`/api/v1/fleet/drivers/${id}/`, data),

  driverStats: () =>
    apiClient.get<DriverStats>('/api/v1/fleet/drivers/stats/'),

  fleetStats: () =>
    apiClient.get<FleetStats>('/api/v1/fleet/stats/'),
}
