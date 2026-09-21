/**
 * Admin data layer for the Users page (Day 11) -- a one-time fetch of
 * every /users document (not a realtime `onSnapshot` subscription, unlike
 * ./announcements.ts's/./notifications.ts's subscribeToX() pattern: the
 * Users list is an admin-only, infrequently-changing view, so a live
 * listener here would be an unnecessary always-on read cost for no real
 * benefit -- the page refetches after a successful role change instead,
 * which is the only time this data actually needs to be current).
 *
 * updateUserRole USED TO call the updateUserRole callable Cloud Function
 * (functions/src/updateUserRole.ts) and nothing else. That made role
 * management completely non-functional in the real deployment: deploying
 * any Cloud Function requires the Blaze plan even at $0 usage, this
 * project deliberately stays on Spark, so the callable does not exist and
 * every invocation failed with functions/not-found. Unlike ./auditLog.ts
 * -- which swallows that failure, because a lost audit entry must not roll
 * back a content write that already succeeded -- this one propagated, so
 * the Users page's role selector was a control that could only ever show
 * an error. Found during the V1 production-readiness audit.
 *
 * It now performs a direct, rules-protected Firestore write, which works
 * on Spark. firestore.rules' users/{userId} update rule is the real
 * authorization boundary and enforces all four invariants the callable
 * used to: the caller is a Super Admin, the target is not the caller (the
 * self-demotion guard), only the `role` field changes, and the new value
 * is a recognised role (isValidRole(), added alongside this change --
 * rules previously did not validate the value, because nothing untrusted
 * could reach the field).
 *
 * functions/src/updateUserRole.ts is retained, correct and tested, for a
 * future Blaze deployment; it is simply not the path this client uses. The
 * audit entry it wrote is instead attempted via ./auditLog.ts, which is
 * itself Blaze-gated -- so a role change currently succeeds without an
 * audit trail. See PRODUCTION_READINESS.md's free-tier limitations.
 */
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './app';
import { logAdminAction } from './auditLog';
import type {
  AdminUserSummary,
  Suspension,
  SuspensionKind,
  UserRole,
} from '../../types';

const USERS_COLLECTION = 'users';

function asDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * M8. The suspension terms, or null.
 *
 * Null for an account nobody suspended, and ALSO for one suspended
 * before the terms existed -- those documents carry only
 * `accountStatus`. ../../features/users/suspension.ts treats a missing
 * expiry as permanent, which is the safe reading: the alternative would
 * reinstate every pre-M8 suspension the moment this shipped.
 *
 * An unrecognised `kind` is read as 'permanent' for the same reason. A
 * value nobody wrote must not become the weakest option.
 */
function toSuspension(value: unknown): Suspension | null {
  if (typeof value !== 'object' || value === null) return null;
  const data = value as Record<string, unknown>;
  return {
    kind: data.kind === 'temporary' ? 'temporary' : 'permanent',
    reason: asString(data.reason),
    startedAt: asDate(data.startedAt),
    expiresAt: asDate(data.expiresAt),
    byUid: asString(data.byUid),
    byName: asString(data.byName),
  };
}

export function toAdminUserSummary(
  uid: string,
  data: Record<string, unknown>
): AdminUserSummary {
  return {
    uid,
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    email: typeof data.email === 'string' ? data.email : null,
    phoneNumber: typeof data.phoneNumber === 'string' ? data.phoneNumber : null,
    role: typeof data.role === 'string' ? (data.role as UserRole) : 'member',
    createdAt: asDate(data.createdAt),
    // M7 fields. Each one maps an UNRECOGNISED or missing value to null
    // rather than to a default that reads like a fact -- "not recorded"
    // and "email account" are different answers, and the page shows the
    // difference. accountStatus is the single exception: anything other
    // than the literal 'suspended' is an active account, because a
    // missing value must never lock a member out.
    gender: data.gender === 'male' || data.gender === 'female' ? data.gender : null,
    appLanguage:
      data.appLanguage === 'en' || data.appLanguage === 'te' ? data.appLanguage : null,
    authProvider:
      data.authProvider === 'password' ||
      data.authProvider === 'google.com' ||
      data.authProvider === 'apple.com'
        ? data.authProvider
        : null,
    lastActiveAt: asDate(data.lastActiveAt),
    profileCompletedAt: asDate(data.profileCompletedAt),
    accountStatus: data.accountStatus === 'suspended' ? 'suspended' : 'active',
    suspension: toSuspension(data.suspension),
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
 * Changes another user's role via a direct, rules-protected write -- see
 * this module's header comment for why this no longer goes through a
 * callable, and which invariants firestore.rules enforces on it.
 *
 * This function deliberately performs no authorization check of its own:
 * firestore.rules is the boundary, and UsersPage.tsx's UI-level checks
 * (the own-row selector is disabled) are a UX convenience only, same as
 * everywhere else in this project. A caller who is not a Super Admin, or
 * who targets themselves, gets permission-denied from Firestore.
 *
 * Only the `role` field is written: the rules' affectedKeys().hasOnly()
 * check would reject anything else, including an updatedAt touch.
 *
 * The audit entry is best-effort and never blocks the role change (see
 * ./auditLog.ts) -- it is currently always lost, since that callable is
 * Blaze-gated too.
 */
export async function updateUserRole(
  targetUid: string,
  newRole: UserRole
): Promise<{ uid: string; role: UserRole }> {
  await updateDoc(doc(db, USERS_COLLECTION, targetUid), { role: newRole });
  await logAdminAction({
    action: 'update',
    collection: 'users',
    documentId: targetUid,
    changeSummary: `Changed role to "${newRole}"`,
  });
  return { uid: targetUid, role: newRole };
}

/**
 * Suspends a member -- M7, with terms since M8.
 *
 * =====================================================================
 * WHAT THIS ACTUALLY DOES, AND WHAT IT CANNOT
 * =====================================================================
 * It writes `accountStatus` and the `suspension` terms on the member's
 * own document. From that moment firestore.rules' isActiveMember()
 * refuses every member-authored WRITE they attempt -- chat messages,
 * prayer requests, media comments, reports -- on the SERVER, whatever
 * client they use. That is a real boundary, not a UI state, and it
 * survives the member reinstalling the app.
 *
 * It does NOT disable their Firebase Auth account, and cannot: that needs
 * the Admin SDK, which needs a deployed Cloud Function, which needs the
 * Blaze plan this project deliberately stays off (the same wall
 * ./auditLog.ts and functions/src/updateUserRole.ts already document).
 * A suspended member therefore keeps a valid token. The app shows them a
 * suspension notice instead of the app on every launch (see
 * mobile/src/features/account/SuspendedScreen.tsx), and the rules refuse
 * their writes; nobody should describe this as the account being
 * disabled, because it is not.
 *
 * =====================================================================
 * NOTHING RUNS WHEN A TEMPORARY SUSPENSION ENDS
 * =====================================================================
 * There is no job, and there does not need to be one. `expiresAt` is
 * written once, here, and compared against the clock wherever the
 * question is asked -- by the rules on every write, and by the app and
 * this dashboard when they display the state. When it passes, the member
 * simply writes again. `accountStatus` is left saying 'suspended',
 * because it is a record of what was decided, not a cache of whether it
 * still applies. See ../../features/users/suspension.ts.
 *
 * A separate write from updateUserRole() above, and a separate rules
 * branch, so one action can never do both: "changed their role" and
 * "suspended them" are different decisions and belong in different audit
 * entries. The rules also refuse a super admin suspending themselves.
 */
export interface SuspendUserInput {
  kind: SuspensionKind;
  /** Required for 'temporary'; ignored (and written as null) otherwise. */
  expiresAt: Date | null;
  reason: string | null;
}

export async function suspendUser(
  targetUid: string,
  input: SuspendUserInput
): Promise<void> {
  const actor = auth.currentUser;
  const expiresAt =
    input.kind === 'temporary' && input.expiresAt
      ? Timestamp.fromDate(input.expiresAt)
      : null;
  const reason = input.reason?.trim() ? input.reason.trim() : null;

  await updateDoc(doc(db, USERS_COLLECTION, targetUid), {
    accountStatus: 'suspended',
    suspension: {
      kind: input.kind,
      reason,
      // The SERVER's clock, not the administrator's browser: "when did
      // this start" is a fact about the record, and a skewed laptop
      // should not be able to date it.
      startedAt: serverTimestamp(),
      expiresAt,
      // The rules require this to equal the caller, so an attribution
      // can never name somebody who did not act.
      byUid: actor?.uid ?? null,
      byName: actor?.displayName ?? actor?.email ?? null,
    },
  });

  await logAdminAction({
    action: 'update',
    collection: 'users',
    documentId: targetUid,
    changeSummary:
      input.kind === 'permanent'
        ? 'Suspended this account permanently'
        : `Suspended this account until ${input.expiresAt?.toISOString() ?? 'an unspecified date'}`,
  });
}

/**
 * Lifts a suspension, whatever kind it was.
 *
 * Clears the terms as well as the status: the two must agree or the
 * rules refuse the write, and leaving stale terms on a restored account
 * would have the dashboard reporting a suspension nobody is serving.
 * The audit entry is where the history lives -- or would, on a plan that
 * allowed one (see ./auditLog.ts).
 */
export async function restoreUserAccess(targetUid: string): Promise<void> {
  await updateDoc(doc(db, USERS_COLLECTION, targetUid), {
    accountStatus: 'active',
    suspension: null,
  });

  await logAdminAction({
    action: 'update',
    collection: 'users',
    documentId: targetUid,
    changeSummary: 'Restored access to this account',
  });
}
