/**
 * frontend/src/api/admin.ts — Admin user-management API
 *
 * Endpoint coverage:
 *   GET   /api/v1/accounts/users/         — paginated user list (ADMIN only)
 *   PATCH /api/v1/accounts/users/<id>/    — update role / is_active (ADMIN only)
 */
import apiClient from './client'
import type { User, PaginatedResponse } from '@/types'

/** Extended user record returned by the admin endpoint (includes is_active). */
export interface AdminUser extends User {
  is_active: boolean
  date_joined: string
  last_login: string | null
}

export const adminApi = {
  /** GET /api/v1/accounts/users/ — paginated list of all users. */
  listUsers: (params?: { page?: number; page_size?: number; role?: string; search?: string }) =>
    apiClient.get<PaginatedResponse<AdminUser>>('/api/v1/accounts/users/', { params }),

  /** PATCH /api/v1/accounts/users/<id>/ — change role or deactivate a user. */
  updateUser: (id: number, data: Partial<Pick<AdminUser, 'role' | 'is_active'>>) =>
    apiClient.patch<AdminUser>(`/api/v1/accounts/users/${id}/`, data),
}
