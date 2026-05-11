import React from 'react'
import { usePermission, useAllPermissions, useAnyPermission } from '@/hooks/usePermission'

interface PermissionGuardProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Conditionally render children based on a granular permission.
 *
 * Usage:
 *   <PermissionGuard permission="shipments.create">
 *     <button>New Shipment</button>
 *   </PermissionGuard>
 */
export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const allowed = usePermission(permission)
  return allowed ? <>{children}</> : <>{fallback}</>
}

/**
 * Conditionally render children if user has ALL specified permissions.
 */
export function AllPermissionsGuard({
  permissions,
  children,
  fallback = null,
}: {
  permissions: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const allowed = useAllPermissions(permissions)
  return allowed ? <>{children}</> : <>{fallback}</>
}

/**
 * Conditionally render children if user has ANY specified permission.
 */
export function AnyPermissionGuard({
  permissions,
  children,
  fallback = null,
}: {
  permissions: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const allowed = useAnyPermission(permissions)
  return allowed ? <>{children}</> : <>{fallback}</>
}
