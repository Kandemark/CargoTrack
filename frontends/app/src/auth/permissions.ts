/**
 * What each role may do, mirroring rolePermissions in
 * services/core/internal/platform/auth/auth.go. The app uses it only to
 * decide what to show; the core enforces every permission itself, so a
 * mismatch here hides or shows a button, never grants access.
 */
export type Permission =
  | 'billing.view'
  | 'billing.manage'
  | 'platform.admin'
  | 'shipments.view'
  | 'shipments.view_assigned'
  | 'shipments.manage'
  | 'shipments.track'
  | 'fleet.view'
  | 'fleet.manage'
  | 'marketplace.view'
  | 'marketplace.bid';

const all: Permission[] = [
  'billing.view', 'billing.manage', 'platform.admin', 'shipments.view', 'shipments.manage',
  'shipments.track', 'fleet.view', 'fleet.manage', 'marketplace.view', 'marketplace.bid',
];

const byRole: Record<string, Permission[]> = {
  platform_owner: all,
  org_admin: all.filter((p) => p !== 'platform.admin'),
  finance: ['billing.view', 'billing.manage', 'shipments.view', 'fleet.view', 'marketplace.view'],
  operations: [
    'billing.view', 'shipments.view', 'shipments.manage', 'shipments.track',
    'fleet.view', 'fleet.manage', 'marketplace.view', 'marketplace.bid',
  ],
  driver: ['shipments.view_assigned', 'shipments.track'],
};

export function can(roles: readonly string[], permission: Permission): boolean {
  return roles.some((r) => byRole[r]?.includes(permission));
}

/** A driver sees only their own jobs. */
export function isDriverOnly(roles: readonly string[]): boolean {
  return !can(roles, 'shipments.view') && can(roles, 'shipments.view_assigned');
}
