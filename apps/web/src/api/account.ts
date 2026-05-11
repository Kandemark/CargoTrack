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

export interface UserProfile {
  id: number
  email: string
  first_name: string
  last_name: string
  role: string
  phone: string | null
}

export interface TOTPSetup {
  secret: string
  qr_code_url: string
  provisioning_uri: string
}

export interface TOTPStatus {
  is_enabled: boolean
  created_at: string | null
}

export interface ApiKeyItem {
  id: number
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
}

export interface ApiKeyCreated extends ApiKeyItem {
  full_key: string
}

export interface OrganizationItem {
  id: number
  name: string
  country: string | null
  org_type: string | null
  tax_id: string | null
  is_active: boolean
  member_count: number
  created_at: string
}

export interface DataExport {
  export_id: string
  status: string
  download_url: string | null
  created_at: string
  expires_at: string
}

// ── API ─────────────────────────────────────────────────────────────────────

export const accountApi = {
  // Profile
  me: () =>
    apiClient.get<UserProfile>('/api/v1/accounts/me/'),

  updateProfile: (data: Partial<Pick<UserProfile, 'first_name' | 'last_name' | 'phone'>>) =>
    apiClient.patch<UserProfile>('/api/v1/accounts/me/', data),

  // Password
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiClient.post<{ detail: string }>('/api/v1/accounts/change-password/', data),

  // Activity
  activity: (params?: { page_size?: number; page?: number }) =>
    apiClient.get<ActivityResponse>('/api/v1/accounts/me/activity/', { params }),

  // Sessions
  sessions: () =>
    apiClient.get<SessionResponse>('/api/v1/accounts/me/sessions/'),

  revokeSession: (id: number) =>
    apiClient.delete(`/api/v1/accounts/me/sessions/${id}/`),

  // Stats
  stats: () =>
    apiClient.get<UserStats>('/api/v1/accounts/me/stats/'),

  // Security log
  securityLog: (params?: { page_size?: number }) =>
    apiClient.get<SecurityLogResponse>('/api/v1/accounts/me/security-log/', { params }),

  // Notification preferences
  notifPrefs: () =>
    apiClient.get<NotifPrefs>('/api/v1/accounts/notification-prefs/'),

  updateNotifPrefs: (prefs: Partial<NotifPrefs>) =>
    apiClient.patch<NotifPrefs>('/api/v1/accounts/notification-prefs/', prefs),

  // ── TOTP / MFA ──────────────────────────────────────────────────────────

  totpSetup: () =>
    apiClient.post<TOTPSetup>('/api/v1/accounts/me/totp/setup/'),

  totpVerify: (data: { code: string }) =>
    apiClient.post<{ detail: string }>('/api/v1/accounts/me/totp/verify/', data),

  totpDisable: (data: { password: string }) =>
    apiClient.post<{ detail: string }>('/api/v1/accounts/me/totp/disable/', data),

  totpStatus: () =>
    apiClient.get<TOTPStatus>('/api/v1/accounts/me/totp/status/'),

  // ── API Keys ────────────────────────────────────────────────────────────

  listApiKeys: () =>
    apiClient.get<{ results: ApiKeyItem[] }>('/api/v1/accounts/api-keys/'),

  createApiKey: (data: { name: string; expires_at?: string }) =>
    apiClient.post<ApiKeyCreated>('/api/v1/accounts/api-keys/', data),

  deleteApiKey: (id: number) =>
    apiClient.delete(`/api/v1/accounts/api-keys/${id}/`),

  // ── Organizations ───────────────────────────────────────────────────────

  listOrganizations: () =>
    apiClient.get<{ results: OrganizationItem[] }>('/api/v1/accounts/organizations/'),

  createOrganization: (data: { name: string; country?: string; org_type?: string }) =>
    apiClient.post<OrganizationItem>('/api/v1/accounts/organizations/', data),

  joinOrganization: (data: { organization_id: number; join_code?: string }) =>
    apiClient.post<{ detail: string }>('/api/v1/accounts/organizations/join/', data),

  getOrganization: (id: number) =>
    apiClient.get<OrganizationItem>(`/api/v1/accounts/organizations/${id}/`),

  updateOrganization: (id: number, data: Partial<OrganizationItem>) =>
    apiClient.patch<OrganizationItem>(`/api/v1/accounts/organizations/${id}/`),

  // ── Display & Locale Preferences ────────────────────────────────────────

  userPreferences: () =>
    apiClient.get<Record<string, string>>('/api/v1/accounts/me/preferences/'),

  updateUserPreferences: (prefs: Record<string, string>) =>
    apiClient.patch<Record<string, string>>('/api/v1/accounts/me/preferences/', prefs),

  // ── GDPR / Data ─────────────────────────────────────────────────────────

  requestExport: () =>
    apiClient.get<DataExport>('/api/v1/accounts/me/export/'),

  deleteAccount: (data: { password: string }) =>
    apiClient.delete<{ detail: string }>('/api/v1/accounts/me/delete/', { data }),
}
