/**
 * roleUtils.ts — Role-to-route mapping utilities shared across guards,
 * pages, the auth store, and the Sidebar.
 *
 * All 9 CargoTrack user roles are defined here:
 *   ADMIN, LOGISTICS_MGR, CLIENT, CARRIER,
 *   DISPATCHER, CUSTOMS_BROKER, WAREHOUSE_MGR, PORT_AGENT, FINANCE_OFFICER
 */

/** Returns the role-specific dashboard URL. Falls back to /login for unknown roles. */
export function getRoleDashboard(role: string | undefined | null): string {
  switch (role) {
    case 'ADMIN':           return '/admin/dashboard'
    case 'LOGISTICS_MGR':   return '/ops/dashboard'
    case 'CARRIER':         return '/driver/dashboard'
    case 'CLIENT':          return '/portal/dashboard'
    case 'DISPATCHER':      return '/dispatch/dashboard'
    case 'CUSTOMS_BROKER':  return '/customs/dashboard'
    case 'WAREHOUSE_MGR':   return '/warehouse/dashboard'
    case 'PORT_AGENT':      return '/port/dashboard'
    case 'FINANCE_OFFICER': return '/finance/dashboard'
    default:                return '/login'
  }
}

/** Allowed-role sets used by RoleRoute and Sidebar filtering. */
export const ROLES = {
  ADMIN_ONLY:    ['ADMIN'],
  OPS:           ['ADMIN', 'LOGISTICS_MGR'],
  CARRIER_ONLY:  ['CARRIER'],
  CLIENT_ONLY:   ['CLIENT'],
  DISPATCHER_ONLY:     ['DISPATCHER'],
  CUSTOMS_ONLY:        ['CUSTOMS_BROKER'],
  WAREHOUSE_ONLY:      ['WAREHOUSE_MGR'],
  PORT_ONLY:           ['PORT_AGENT'],
  FINANCE_ONLY:        ['FINANCE_OFFICER'],
  /** All roles that can view fleet data (ops + dispatcher). */
  FLEET_ACCESS:  ['ADMIN', 'LOGISTICS_MGR', 'DISPATCHER'],
  /** All roles that can view financial data. */
  FINANCE_ACCESS:['ADMIN', 'LOGISTICS_MGR', 'FINANCE_OFFICER'],
  /** Everyone authenticated. */
  ALL: [
    'ADMIN', 'LOGISTICS_MGR', 'CARRIER', 'CLIENT',
    'DISPATCHER', 'CUSTOMS_BROKER', 'WAREHOUSE_MGR', 'PORT_AGENT', 'FINANCE_OFFICER',
  ],
} as const
