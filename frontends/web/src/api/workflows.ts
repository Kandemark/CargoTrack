/**
 * workflows.ts — API client for automated workflow rules engine.
 *
 * Endpoints:
 *   GET    /api/v1/workflows/       — list all rules
 *   POST   /api/v1/workflows/       — create a rule
 *   GET    /api/v1/workflows/<id>/  — get rule detail
 *   PATCH  /api/v1/workflows/<id>/  — update a rule
 *   DELETE /api/v1/workflows/<id>/  — delete a rule
 */
import apiClient from './client'

export interface WorkflowRule {
  id: number
  name: string
  trigger_type: string
  trigger_config: Record<string, string>
  action_type: string
  action_config: Record<string, string>
  severity: string
  is_active: boolean
  execution_count: number
  created_at: string
  updated_at: string
}

export const workflowsApi = {
  list: () =>
    apiClient.get<WorkflowRule[]>('/api/v1/workflows/'),

  get: (id: number) =>
    apiClient.get<WorkflowRule>(`/api/v1/workflows/${id}/`),

  create: (data: Partial<WorkflowRule>) =>
    apiClient.post<WorkflowRule>('/api/v1/workflows/', data),

  update: (id: number, data: Partial<WorkflowRule>) =>
    apiClient.patch<WorkflowRule>(`/api/v1/workflows/${id}/`, data),

  delete: (id: number) =>
    apiClient.delete(`/api/v1/workflows/${id}/`),
}
