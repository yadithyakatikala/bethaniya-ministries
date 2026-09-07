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

/**
 * An announcement document at /announcements/{id}, per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 4 plan and firestore.rules'
 * isValidAnnouncement() (which enforces title/content/published's shape
 * server-side -- see that rule's comment for why imageUrl and the
 * timestamps aren't rules-validated the same strict way).
 */
export interface Announcement {
  id: string;
  title: string;
  content: string;
  /** Storage download URL, or null until an image is uploaded/if none is set. */
  imageUrl: string | null;
  /** Controls visibility to members -- see firestore.rules' announcements read rule. */
  published: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Fields the admin form actually collects -- id/createdAt/updatedAt/published are set elsewhere (see services/firebase/announcements.ts). */
export interface AnnouncementFormInput {
  title: string;
  content: string;
  imageUrl: string | null;
}
