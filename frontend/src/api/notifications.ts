import apiClient from './client'
import type { PaginatedResponse } from '@/types'

export interface Notification {
  id: number
  user: number | null
  type: 'ALERT' | 'SHIPMENT' | 'PAYMENT' | 'SYSTEM' | 'SECURITY'
  title: string
  message: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  is_read: boolean
  is_dismissed: boolean
  related_url: string
  created_at: string
}

export const notificationsApi = {
  list: (params?: { type?: string; unread?: string }) =>
    apiClient.get<Notification[]>('/api/v1/notifications/', { params }),

  markRead: (id: number) =>
    apiClient.patch<Notification>(`/api/v1/notifications/${id}/read/`),

  markAllRead: () =>
    apiClient.patch('/api/v1/notifications/mark-all-read/'),

  dismiss: (id: number) =>
    apiClient.delete(`/api/v1/notifications/${id}/`),
}
