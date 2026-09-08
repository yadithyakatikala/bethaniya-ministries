/**
 * Admin data layer for the Users page (Day 11) -- a one-time fetch of
 * every /users document (not a realtime `onSnapshot` subscription, unlike
 * ./announcements.ts's/./notifications.ts's subscribeToX() pattern: the
 * Users list is an admin-only, infrequently-changing view, so a live
 * listener here would be an unnecessary always-on read cost for no real
 * benefit -- the page refetches after a successful role change instead,
 * which is the only time this data actually needs to be current).
 *
 * updateUserRole calls the updateUserRole callable Cloud Function
 * (functions/src/updateUserRole.ts) -- exactly like ./notifications.ts's
 * sendNotification, this never writes to Firestore directly from the
 * client. Only the callable's Admin SDK actually changes a `role` field
 * and writes the matching /audit_log entry; firestore.rules' own
 * super_admin-only, role-field-only update rule stays in place too, as
 * defense in depth, but is not what this client code relies on.
 */
import { Timestamp, collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './app';
import type { AdminUserSummary, UserRole } from '../../types';

const USERS_COLLECTION = 'users';

interface UpdateUserRoleCallableInput {
  targetUid: string;
  newRole: UserRole;
}

interface UpdateUserRoleCallableResult {
  updated: true;
  uid: string;
  role: UserRole;
}

const callUpdateUserRole = httpsCallable<
  UpdateUserRoleCallableInput,
  UpdateUserRoleCallableResult
>(functions, 'updateUserRole');

function toAdminUserSummary(
  uid: string,
  data: Record<string, unknown>
): AdminUserSummary {
  return {
    uid,
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    email: typeof data.email === 'string' ? data.email : null,
    phoneNumber: typeof data.phoneNumber === 'string' ? data.phoneNumber : null,
    role: typeof data.role === 'string' ? (data.role as UserRole) : 'member',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  };
}

/**
 * One-time fetch of every user -- see this module's header comment for
 * why this is `getDocs`, not a realtime subscription. Call again (the
 * Users page does, after a successful role change) to pick up changes;
 * there is no live update in between.
 */
export async function fetchAllUsers(): Promise<AdminUserSummary[]> {
  const snapshot = await getDocs(collection(db, USERS_COLLECTION));
  return snapshot.docs.map((d) => toAdminUserSummary(d.id, d.data()));
}

/**
 * Changes another user's role. The callable independently re-validates
 * the caller is a Super Admin and independently rejects a caller
 * targeting their own uid (self-demotion guard) -- see
 * functions/src/updateUserRole.ts's header comment. This function does
 * not attempt either check itself; UsersPage.tsx's own UI-level checks
 * (hiding/disabling the control) are a UX convenience only, same as
 * everywhere else in this project.
 */
export async function updateUserRole(
  targetUid: string,
  newRole: UserRole
): Promise<{ uid: string; role: UserRole }> {
  const result = await callUpdateUserRole({ targetUid, newRole });
  return { uid: result.data.uid, role: result.data.role };
}
