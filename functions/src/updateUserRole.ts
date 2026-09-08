/**
 * updateUserRole -- Day 11, the admin Users page's "change role" action
 * (FINAL_ARCHITECTURE_SPECIFICATION.md's Day 11 plan: "Admin: Role
 * selector (dropdown to change role, Super Admin only)", "Cloud
 * Functions: Validate role change (only Super Admin can change roles)").
 *
 * Callable, following the identical architecture as ./logAdminAction.ts
 * and ./sendNotification.ts -- see logAdminAction.ts's header comment for
 * the full "why callable, not a Firestore trigger" reasoning (a trigger
 * carries no caller identity, so it can't produce a trustworthy actor for
 * a security-sensitive change like this one). Same plain-Error-subclass-
 * not-HttpsError pattern for the same Jest/ESM reason; index.ts's onCall
 * wrapper converts it into a real HttpsError for actual callable clients.
 *
 * This function does two things atomically from the caller's point of
 * view (both happen in one handler invocation, so a client can't get a
 * role change without a matching audit entry the way it could if logging
 * were a separate client-initiated call): it changes the target user's
 * `role` field via the Admin SDK (bypassing firestore.rules, which
 * independently also permits only a super_admin to touch `role` -- see
 * that rule's own comment -- so this is defense in depth, not the only
 * boundary), and it writes a matching /audit_log entry, reusing the exact
 * same entry shape logAdminAction.ts's `users` collection audit subject
 * already defines.
 *
 * SELF-DEMOTION GUARD: a Super Admin can never change their own role
 * through this function, full stop -- checked here, server-side,
 * independently of whatever the admin UI does (UsersPage.tsx additionally
 * disables the role selector on the signed-in Super Admin's own row, but
 * that is a UX convenience only, same as every other client-side gate in
 * this project -- this handler enforces it unconditionally so a direct
 * callable invocation bypassing the UI is rejected the same way). Without
 * this, a Super Admin (or a bug, or a compromised admin session) could
 * accidentally demote themselves out of Super Admin entirely, with no
 * remaining path back in short of direct database access.
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

export class UpdateUserRoleError extends Error {
  constructor(
    public readonly code:
      | 'unauthenticated'
      | 'invalid-argument'
      | 'permission-denied'
      | 'not-found',
    message: string
  ) {
    super(message);
    this.name = 'UpdateUserRoleError';
  }
}

/** Every role a Super Admin may assign -- matches admin/src/types.ts's
 * UserRole exactly (all four roles are valid *targets*; which caller may
 * invoke this at all is a separate, narrower check below). */
export const ASSIGNABLE_ROLES = ['super_admin', 'content_admin', 'host', 'member'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Only a Super Admin may call this at all -- matches firestore.rules'
 * users/{userId} update rule's own super_admin-only role-change branch. */
const ALLOWED_CALLER_ROLES = new Set(['super_admin']);

export interface UpdateUserRoleInput {
  targetUid: string;
  newRole: AssignableRole;
}

/** The subset of a callable request's verified auth context this handler
 * actually reads -- same narrowing as logAdminAction.ts's/
 * sendNotification.ts's CallerAuthContext, for the same testability
 * reason. */
export interface CallerAuthContext {
  uid: string;
  email: string | null;
}

function isValidInput(data: unknown): data is UpdateUserRoleInput {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.targetUid === 'string' &&
    d.targetUid.length > 0 &&
    typeof d.newRole === 'string' &&
    (ASSIGNABLE_ROLES as readonly string[]).includes(d.newRole)
  );
}

/**
 * The actual logic, exported separately from the onCall wrapper below so it
 * can be unit-tested directly against a real Firestore emulator via
 * FIRESTORE_EMULATOR_HOST -- same pattern as logAdminActionHandler/
 * sendNotificationHandler. See updateUserRole.test.ts.
 */
export async function updateUserRoleHandler(
  data: unknown,
  auth: CallerAuthContext | undefined
): Promise<{ updated: true; uid: string; role: AssignableRole }> {
  if (!auth) {
    throw new UpdateUserRoleError(
      'unauthenticated',
      'You must be signed in to change a user role.'
    );
  }

  if (!isValidInput(data)) {
    throw new UpdateUserRoleError(
      'invalid-argument',
      `targetUid (non-empty string) and a valid newRole (${ASSIGNABLE_ROLES.join('/')}) are required.`
    );
  }

  const db = getFirestore();
  const callerSnapshot = await db.collection('users').doc(auth.uid).get();
  const callerRole = callerSnapshot.exists
    ? (callerSnapshot.data()?.role as string | undefined)
    : undefined;

  if (!callerRole || !ALLOWED_CALLER_ROLES.has(callerRole)) {
    throw new UpdateUserRoleError(
      'permission-denied',
      'Your account is not authorized to change user roles.'
    );
  }

  // Self-demotion guard -- see this file's header comment. Checked after
  // confirming the caller is actually a Super Admin (so a non-Super-Admin
  // caller targeting themselves still gets the more accurate "not
  // authorized" error, not this one), but before touching the target
  // document at all.
  if (data.targetUid === auth.uid) {
    throw new UpdateUserRoleError(
      'permission-denied',
      'You cannot change your own role.'
    );
  }

  const targetRef = db.collection('users').doc(data.targetUid);
  const targetSnapshot = await targetRef.get();
  if (!targetSnapshot.exists) {
    throw new UpdateUserRoleError('not-found', 'That user does not exist.');
  }

  const previousRole = targetSnapshot.data()?.role;

  await targetRef.update({ role: data.newRole });

  await db.collection('audit_log').add({
    timestamp: FieldValue.serverTimestamp(),
    // Always derived from verified auth, never from `data` -- a client
    // cannot claim to be a different admin than the one it authenticated
    // as, same principle as logAdminAction.ts/sendNotification.ts.
    admin_id: auth.uid,
    admin_email: auth.email,
    action: 'update',
    collection: 'users',
    document_id: data.targetUid,
    change_summary: `Changed role from '${typeof previousRole === 'string' ? previousRole : 'unknown'}' to '${data.newRole}'`,
    details: {
      previousRole: typeof previousRole === 'string' ? previousRole : null,
      newRole: data.newRole,
    },
  });

  return { updated: true, uid: data.targetUid, role: data.newRole };
}
