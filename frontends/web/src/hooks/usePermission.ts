import { useAuthStore } from '@/store/authStore'
import { hasPermission, hasAllPermissions, hasAnyPermission } from '@/lib/roleUtils'
import type { PermissionType } from '@/lib/roleUtils'

/**
 * React hook: check if the current user has a specific granular permission.
 *
 * Usage:
 *   const canCreate = usePermission('shipments.create')
 *   if (canCreate) { ... }
 */
export function usePermission(permission: string): boolean {
  const user = useAuthStore(state => state.user)
  return hasPermission(user, permission)
}

/**
 * React hook: check if the current user has ALL of the specified permissions.
 */
export function useAllPermissions(permissions: string[]): boolean {
  const user = useAuthStore(state => state.user)
  return hasAllPermissions(user, permissions)
}

/**
 * React hook: check if the current user has ANY of the specified permissions.
 */
export function useAnyPermission(permissions: string[]): boolean {
  const user = useAuthStore(state => state.user)
  return hasAnyPermission(user, permissions)
}

export type { PermissionType }
