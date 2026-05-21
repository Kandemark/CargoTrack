/**
 * roleUtils.ts — Centralized role metadata, permission constants, and
 * role→permission mapping matching the backend RBAC system.
 *
 * All 9 CargoTrack user roles and 35 granular permissions are defined here.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Role Display Metadata
// ═══════════════════════════════════════════════════════════════════════════════

export const ROLE_LABELS: Record<string, string> = {
  ADMIN:           'Administrator',
  LOGISTICS_MGR:   'Logistics Manager',
  CARRIER:         'Carrier / Driver',
  CLIENT:          'Client',
  DISPATCHER:      'Dispatcher',
  CUSTOMS_BROKER:  'Customs Broker',
  WAREHOUSE_MGR:   'Warehouse Manager',
  PORT_AGENT:      'Port Agent',
  FINANCE_OFFICER: 'Finance Officer',
}

export const ROLE_COLOR: Record<string, string> = {
  ADMIN:           '#dc2626',
  LOGISTICS_MGR:   '#0f2d5e',
  CARRIER:         '#2563eb',
  CLIENT:          '#7c3aed',
  DISPATCHER:      '#0891b2',
  CUSTOMS_BROKER:  '#b45309',
  WAREHOUSE_MGR:   '#16a34a',
  PORT_AGENT:      '#0f766e',
  FINANCE_OFFICER: '#9333ea',
}

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

// ═══════════════════════════════════════════════════════════════════════════════
// Granular Permissions — mirrors backend domains/_authz.py Permission enum
// ═══════════════════════════════════════════════════════════════════════════════

export const Permission = {
  // Shipments
  SHIPMENTS_VIEW:     'shipments.view',
  SHIPMENTS_CREATE:   'shipments.create',
  SHIPMENTS_UPDATE:   'shipments.update',
  SHIPMENTS_DELETE:   'shipments.delete',
  SHIPMENTS_DISPATCH: 'shipments.dispatch',
  SHIPMENTS_TRACK:    'shipments.track',
  // Routes
  ROUTES_VIEW:   'routes.view',
  ROUTES_MANAGE: 'routes.manage',
  // Contracts & Rates
  RATES_VIEW:      'rates.view',
  RATES_MANAGE:    'rates.manage',
  CONTRACTS_VIEW:  'contracts.view',
  CONTRACTS_MANAGE:'contracts.manage',
  // Finance
  FINANCE_VIEW:    'finance.view',
  FINANCE_MANAGE:  'finance.manage',
  FINANCE_APPROVE: 'finance.approve',
  // Customs & Borders
  CUSTOMS_VIEW:   'customs.view',
  CUSTOMS_SUBMIT: 'customs.submit',
  CUSTOMS_CLEAR:  'customs.clear',
  // Fleet
  FLEET_VIEW:   'fleet.view',
  FLEET_MANAGE: 'fleet.manage',
  FLEET_ASSIGN: 'fleet.assign',
  // Port Operations
  PORTS_VIEW:   'ports.view',
  PORTS_MANAGE: 'ports.manage',
  // Cold Chain
  COLDCHAIN_VIEW:   'coldchain.view',
  COLDCHAIN_MANAGE: 'coldchain.manage',
  // Documents
  DOCUMENTS_VIEW:   'documents.view',
  DOCUMENTS_UPLOAD: 'documents.upload',
  DOCUMENTS_VERIFY: 'documents.verify',
  // Analytics
  ANALYTICS_VIEW:   'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',
  // Communications
  CHAT_SEND:   'chat.send',
  CHAT_MANAGE: 'chat.manage',
  // Marketplace
  MARKETPLACE_VIEW:   'marketplace.view',
  MARKETPLACE_BID:    'marketplace.bid',
  MARKETPLACE_MANAGE: 'marketplace.manage',
  // Predictions
  PREDICTIONS_VIEW: 'predictions.view',
  // Administration
  ADMIN_USERS:  'admin.users',
  ADMIN_SYSTEM: 'admin.system',
  ADMIN_AUDIT:  'admin.audit',
} as const

export type PermissionType = typeof Permission[keyof typeof Permission]

// ═══════════════════════════════════════════════════════════════════════════════
// Role → Permission Mapping — mirrors backend domains/_authz.py RolePermissions
// ═══════════════════════════════════════════════════════════════════════════════

const P = Permission

const _rolePermissions: Record<string, ReadonlySet<string>> = {
  ADMIN: new Set([
    P.SHIPMENTS_VIEW, P.SHIPMENTS_CREATE, P.SHIPMENTS_UPDATE, P.SHIPMENTS_DELETE,
    P.SHIPMENTS_DISPATCH, P.SHIPMENTS_TRACK,
    P.ROUTES_VIEW, P.ROUTES_MANAGE,
    P.RATES_VIEW, P.RATES_MANAGE,
    P.CONTRACTS_VIEW, P.CONTRACTS_MANAGE,
    P.FINANCE_VIEW, P.FINANCE_MANAGE, P.FINANCE_APPROVE,
    P.CUSTOMS_VIEW, P.CUSTOMS_SUBMIT, P.CUSTOMS_CLEAR,
    P.FLEET_VIEW, P.FLEET_MANAGE, P.FLEET_ASSIGN,
    P.PORTS_VIEW, P.PORTS_MANAGE,
    P.COLDCHAIN_VIEW, P.COLDCHAIN_MANAGE,
    P.DOCUMENTS_VIEW, P.DOCUMENTS_UPLOAD, P.DOCUMENTS_VERIFY,
    P.ANALYTICS_VIEW, P.ANALYTICS_EXPORT,
    P.CHAT_SEND, P.CHAT_MANAGE,
    P.MARKETPLACE_VIEW, P.MARKETPLACE_BID, P.MARKETPLACE_MANAGE,
    P.PREDICTIONS_VIEW,
    P.ADMIN_USERS, P.ADMIN_SYSTEM, P.ADMIN_AUDIT,
  ]),

  LOGISTICS_MGR: new Set([
    P.SHIPMENTS_VIEW, P.SHIPMENTS_CREATE, P.SHIPMENTS_UPDATE, P.SHIPMENTS_DISPATCH,
    P.SHIPMENTS_TRACK,
    P.ROUTES_VIEW,
    P.RATES_VIEW,
    P.CONTRACTS_VIEW, P.CONTRACTS_MANAGE,
    P.FINANCE_VIEW,
    P.CUSTOMS_VIEW, P.CUSTOMS_SUBMIT,
    P.FLEET_VIEW, P.FLEET_MANAGE, P.FLEET_ASSIGN,
    P.PORTS_VIEW,
    P.COLDCHAIN_VIEW, P.COLDCHAIN_MANAGE,
    P.DOCUMENTS_VIEW, P.DOCUMENTS_UPLOAD,
    P.ANALYTICS_VIEW, P.ANALYTICS_EXPORT,
    P.CHAT_SEND, P.CHAT_MANAGE,
    P.MARKETPLACE_VIEW, P.MARKETPLACE_MANAGE,
    P.PREDICTIONS_VIEW,
  ]),

  DISPATCHER: new Set([
    P.SHIPMENTS_VIEW, P.SHIPMENTS_CREATE, P.SHIPMENTS_UPDATE, P.SHIPMENTS_DISPATCH,
    P.SHIPMENTS_TRACK,
    P.ROUTES_VIEW,
    P.RATES_VIEW, P.CONTRACTS_VIEW,
    P.FLEET_VIEW, P.FLEET_ASSIGN,
    P.ANALYTICS_VIEW,
    P.CHAT_SEND,
    P.MARKETPLACE_VIEW,
    P.PREDICTIONS_VIEW,
  ]),

  CLIENT: new Set([
    P.SHIPMENTS_VIEW, P.SHIPMENTS_CREATE,
    P.ROUTES_VIEW,
    P.RATES_VIEW, P.CONTRACTS_VIEW,
    P.FINANCE_VIEW,
    P.CUSTOMS_VIEW,
    P.PORTS_VIEW,
    P.COLDCHAIN_VIEW,
    P.ANALYTICS_VIEW,
    P.CHAT_SEND,
    P.MARKETPLACE_VIEW, P.MARKETPLACE_MANAGE,
    P.PREDICTIONS_VIEW,
  ]),

  CARRIER: new Set([
    P.SHIPMENTS_VIEW, P.SHIPMENTS_TRACK,
    P.ROUTES_VIEW,
    P.RATES_VIEW, P.RATES_MANAGE,
    P.CONTRACTS_VIEW,
    P.FINANCE_VIEW,
    P.CUSTOMS_VIEW,
    P.FLEET_VIEW, P.FLEET_MANAGE,
    P.PORTS_VIEW,
    P.COLDCHAIN_VIEW,
    P.ANALYTICS_VIEW,
    P.CHAT_SEND,
    P.MARKETPLACE_VIEW, P.MARKETPLACE_BID,
    P.PREDICTIONS_VIEW,
  ]),

  DRIVER: new Set([
    P.SHIPMENTS_VIEW, P.SHIPMENTS_TRACK,
    P.DOCUMENTS_VIEW, P.DOCUMENTS_UPLOAD,
    P.CHAT_SEND,
  ]),

  CUSTOMS_BROKER: new Set([
    P.SHIPMENTS_VIEW,
    P.RATES_VIEW,
    P.CUSTOMS_VIEW, P.CUSTOMS_SUBMIT, P.CUSTOMS_CLEAR,
    P.ANALYTICS_VIEW,
    P.CHAT_SEND,
    P.MARKETPLACE_VIEW,
    P.PREDICTIONS_VIEW,
  ]),

  WAREHOUSE_MGR: new Set([
    P.SHIPMENTS_VIEW, P.SHIPMENTS_CREATE, P.SHIPMENTS_DISPATCH,
    P.FLEET_VIEW,
    P.COLDCHAIN_VIEW, P.COLDCHAIN_MANAGE,
    P.DOCUMENTS_VIEW, P.DOCUMENTS_UPLOAD, P.DOCUMENTS_VERIFY,
    P.ANALYTICS_VIEW,
    P.CHAT_SEND,
    P.MARKETPLACE_VIEW,
    P.PREDICTIONS_VIEW,
  ]),

  PORT_AGENT: new Set([
    P.SHIPMENTS_VIEW, P.SHIPMENTS_TRACK,
    P.RATES_VIEW,
    P.CUSTOMS_VIEW, P.CUSTOMS_SUBMIT,
    P.PORTS_VIEW, P.PORTS_MANAGE,
    P.ANALYTICS_VIEW,
    P.CHAT_SEND,
    P.MARKETPLACE_VIEW,
    P.PREDICTIONS_VIEW,
  ]),

  FINANCE_OFFICER: new Set([
    P.SHIPMENTS_VIEW,
    P.RATES_VIEW,
    P.CONTRACTS_VIEW,
    P.FINANCE_VIEW, P.FINANCE_MANAGE,
    P.ANALYTICS_VIEW,
    P.CHAT_SEND,
    P.MARKETPLACE_VIEW,
    P.PREDICTIONS_VIEW,
  ]),
}

// ═══════════════════════════════════════════════════════════════════════════════
// Permission Checker
// ═══════════════════════════════════════════════════════════════════════════════

interface UserLike {
  role?: string | null
}

/**
 * Check whether a user has a specific granular permission.
 * Mirrors backend domains/_authz.py has_permission().
 *
 * Usage:
 *   if (hasPermission(user, Permission.SHIPMENTS_CREATE)) { ... }
 */
export function hasPermission(
  user: UserLike | null | undefined,
  permission: string,
): boolean {
  if (!user?.role) return false
  const perms = _rolePermissions[user.role]
  if (!perms) return false
  return perms.has(permission)
}

/**
 * Check whether a user has ALL of the specified permissions.
 */
export function hasAllPermissions(
  user: UserLike | null | undefined,
  permissions: string[],
): boolean {
  if (!permissions.length) return true
  return permissions.every(p => hasPermission(user, p))
}

/**
 * Check whether a user has ANY of the specified permissions.
 */
export function hasAnyPermission(
  user: UserLike | null | undefined,
  permissions: string[],
): boolean {
  if (!permissions.length) return true
  return permissions.some(p => hasPermission(user, p))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Role Group Helpers (for route guards)
// ═══════════════════════════════════════════════════════════════════════════════

export const ROLES = {
  ADMIN_ONLY:       ['ADMIN'],
  OPS:              ['ADMIN', 'LOGISTICS_MGR'],
  CARRIER_ONLY:     ['CARRIER'],
  CLIENT_ONLY:      ['CLIENT'],
  DISPATCHER_ONLY:  ['DISPATCHER'],
  CUSTOMS_ONLY:     ['CUSTOMS_BROKER'],
  WAREHOUSE_ONLY:   ['WAREHOUSE_MGR'],
  PORT_ONLY:        ['PORT_AGENT'],
  FINANCE_ONLY:     ['FINANCE_OFFICER'],
  FLEET_ACCESS:     ['ADMIN', 'LOGISTICS_MGR', 'DISPATCHER'],
  FINANCE_ACCESS:   ['ADMIN', 'LOGISTICS_MGR', 'FINANCE_OFFICER'],
  ALL: [
    'ADMIN', 'LOGISTICS_MGR', 'CARRIER', 'CLIENT',
    'DISPATCHER', 'CUSTOMS_BROKER', 'WAREHOUSE_MGR', 'PORT_AGENT', 'FINANCE_OFFICER',
  ],
} as const

/** Alias — some files reference ROLE_LABEL (singular). */
export { ROLE_LABELS as ROLE_LABEL }
