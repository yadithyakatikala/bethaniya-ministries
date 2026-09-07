/**
 * Shared TypeScript types for the admin dashboard.
 * Populated incrementally as features are built (auth, content models, etc).
 */

export type UserRole = 'super_admin' | 'content_admin' | 'host' | 'member';

/** Roles that may access the admin dashboard at all -- everything except plain members. */
export const ADMIN_DASHBOARD_ROLES: readonly UserRole[] = [
  'host',
  'content_admin',
  'super_admin',
];

export function canAccessAdminDashboard(role: UserRole | null): boolean {
  return role !== null && ADMIN_DASHBOARD_ROLES.includes(role);
}
