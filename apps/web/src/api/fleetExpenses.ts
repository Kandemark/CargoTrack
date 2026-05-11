/**
 * fleetExpenses.ts — API client for driver/fleet expense tracking.
 */
import apiClient from './client'

export interface FleetExpense {
  id: number
  driver: number
  driver_name: string | null
  truck: number | null
  truck_plate: string | null
  expense_type: 'FUEL' | 'MAINTENANCE' | 'TOLL' | 'PERMIT' | 'ACCOMMODATION' | 'MEAL' | 'BORDER_FEE' | 'OTHER'
  amount: string
  currency: string
  description: string
  receipt_url: string | null
  expense_date: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approved_by: number | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export const fleetExpensesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<{ count: number; results: FleetExpense[] }>('/api/v1/fleet/expenses/', { params }),

  get: (id: number) =>
    apiClient.get<FleetExpense>(`/api/v1/fleet/expenses/${id}/`),

  create: (data: Partial<FleetExpense>) =>
    apiClient.post<FleetExpense>('/api/v1/fleet/expenses/', data),

  update: (id: number, data: Partial<FleetExpense>) =>
    apiClient.patch<FleetExpense>(`/api/v1/fleet/expenses/${id}/`, data),

  delete: (id: number) =>
    apiClient.delete(`/api/v1/fleet/expenses/${id}/`),
}
