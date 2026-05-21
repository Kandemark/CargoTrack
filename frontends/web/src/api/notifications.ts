import apiClient from './client'

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

export interface NotificationPreferences {
  channels: {
    in_app: boolean
    email: boolean
    sms: boolean
    push: boolean
  }
  per_type: Record<string, {
    in_app: boolean
    email: boolean
    sms: boolean
    push: boolean
  }>
  digest_enabled: boolean
  digest_frequency: 'instant' | 'hourly' | 'daily'
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
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

  getPreferences: () =>
    apiClient.get<NotificationPreferences>('/api/v1/notifications/preferences/'),

  updatePreferences: (data: Partial<NotificationPreferences>) =>
    apiClient.patch<NotificationPreferences>('/api/v1/notifications/preferences/', data),
}
