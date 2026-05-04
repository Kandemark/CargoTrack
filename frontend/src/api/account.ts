/**
 * account.ts — API client for user profile enrichment endpoints.
 */
import apiClient from './client'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ActivityItem {
  timestamp: string
  action_type: string
  description: string
  resource: string
  detail: string
}

export interface ActivityResponse {
  total: number
  page: number
  page_size: number
  activities: ActivityItem[]
}

export interface SessionItem {
  id: number
  created_at: string | null
  is_current: boolean
  expires_at: string | null
  ip_address: string
  user_agent: string
  device: 'desktop' | 'mobile' | 'tablet'
  browser: string
}

export interface SessionResponse {
  sessions: SessionItem[]
}

export interface UserStats {
  total_shipments: number
  shipments_mtd: number
  events_logged: number
  events_mtd: number
  docs_uploaded: number
  alerts_acknowledged: number
  most_used_carrier: string | null
  monthly_activity: {
    month: string
    shipments: number
    events: number
    docs: number
  }[]
}

export interface SecurityLogEntry {
  timestamp: string
  action: string
  result: string
  description: string
  ip_address: string
}

export interface SecurityLogResponse {
  entries: SecurityLogEntry[]
  last_login: string | null
}

export interface NotifPrefs {
  email_on_delay: boolean
  email_on_customs: boolean
  email_on_delivery: boolean
  push_on_delay: boolean
  push_on_customs: boolean
  push_on_delivery: boolean
}

// ── API ─────────────────────────────────────────────────────────────────────

export const accountApi = {
  activity: (params?: { page_size?: number; page?: number }) =>
    apiClient.get<ActivityResponse>('/api/v1/accounts/me/activity/', { params }),

  sessions: () =>
    apiClient.get<SessionResponse>('/api/v1/accounts/me/sessions/'),

  revokeSession: (id: number) =>
    apiClient.delete(`/api/v1/accounts/me/sessions/${id}/`),

  stats: () =>
    apiClient.get<UserStats>('/api/v1/accounts/me/stats/'),

  securityLog: (params?: { page_size?: number }) =>
    apiClient.get<SecurityLogResponse>('/api/v1/accounts/me/security-log/', { params }),

  notifPrefs: () =>
    apiClient.get<NotifPrefs>('/api/v1/accounts/notification-prefs/'),

  updateNotifPrefs: (prefs: Partial<NotifPrefs>) =>
    apiClient.patch<NotifPrefs>('/api/v1/accounts/notification-prefs/', prefs),
}
