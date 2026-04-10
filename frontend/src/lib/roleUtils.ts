/**
 * frontend/src/lib/roleUtils.ts
 * Role-to-route mapping utilities shared across guards, pages, and the auth store.
 */

/** Returns the dashboard URL for the given role. Falls back to /login for unknown roles. */
export function getRoleDashboard(role: string | undefined | null): string {
  switch (role) {
    case 'ADMIN':         return '/admin/dashboard'
    case 'LOGISTICS_MGR': return '/ops/dashboard'
    case 'CARRIER':       return '/driver/dashboard'
    case 'CLIENT':        return '/portal/dashboard'
    default:              return '/login'
  }
}

/** Allowed-role sets used by RoleRoute and Sidebar filtering. */
export const ROLES = {
  ADMIN_ONLY:   ['ADMIN'],
  OPS:          ['ADMIN', 'LOGISTICS_MGR'],
  CARRIER_ONLY: ['CARRIER'],
  CLIENT_ONLY:  ['CLIENT'],
  ALL:          ['ADMIN', 'LOGISTICS_MGR', 'CARRIER', 'CLIENT'],
} as const
