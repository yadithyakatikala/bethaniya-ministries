/**
 * logAdminAction — writes an immutable /audit_log entry for an admin/host
 * action, per FINAL_ARCHITECTURE_SPECIFICATION.md's Day 3 plan ("Cloud
 * Functions: logAdminAction() triggers on writes (audit logging)") and its
 * "Audit Log Entry Format" section.
 *
 * Callable, not a Firestore background trigger -- see /SECURITY.md's "Day 3"
 * section for the full reasoning, summarized here: a Firestore onWrite-style
 * trigger (functions.firestore.document().onWrite / onDocumentWritten) does
 * NOT receive the identity of whoever made the write -- Firestore triggers
 * carry no `auth` context at all (unlike Realtime Database triggers, and
 * unlike callable functions). Since the spec's own audit-log format requires
 * a trustworthy `admin_id`/`admin_email`, and this project's established
 * principle (see createUserProfile.ts) is to never trust a client-supplied
 * identity field, a background trigger could only get an admin identity by
 * trusting a `lastModifiedBy`-style field the client itself wrote onto the
 * document -- which is exactly the kind of client-trusted identity this
 * project avoids elsewhere. A callable function is called by the admin
 * client immediately after it performs a Firestore write, and derives
 * `admin_id`/`admin_email` from Firebase's own verified callable-auth
 * context (`request.auth`), which the client cannot forge.
 *
 * Trust boundary: the *content* of the log entry (action/collection/
 * documentId/changeSummary/details) is client-supplied, same as any other
 * write -- there is no way around that for a "here's what I just did"
 * report, and it is not a security-sensitive value the way a role is. What
 * *is* enforced server-side, unconditionally: who is making the claim
 * (admin_id/admin_email, from verified auth, never from the request body)
 * and that they hold a role allowed to make it at all (host/content_admin/
 * super_admin -- a signed-in member is rejected, matching the RBAC table's
 * "audit_log: Member none" row and the fact that members never perform any
 * of the actions this log records).
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

/**
 * A plain Error subclass, not firebase-functions' own HttpsError -- this
 * file deliberately never imports anything from 'firebase-functions/v2/https'.
 * That module transitively pulls in firebase-admin's auth token-verification
 * code (-> jwks-rsa -> an ESM package), which crashes Jest the same way
 * 'firebase-functions/v1' did for healthCheck.ts (see that file's Day 1
 * notes and ARCHITECTURE.md). index.ts's onCall wrapper -- which nothing
 * under Jest ever executes -- converts this into a real HttpsError for
 * actual callable clients; this file and its tests only ever see this
 * lightweight type.
 */
export class AdminActionError extends Error {
  constructor(
    public readonly code: 'unauthenticated' | 'invalid-argument' | 'permission-denied',
    message: string
  ) {
    super(message);
    this.name = 'AdminActionError';
  }
}

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'publish',
  'unpublish',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** The collections admin/host actions are actually logged for, per the
 * spec's "What is Logged" list (content creation/modification, role
 * changes, settings changes). Does not include `notifications_log` or
 * `audit_log` itself -- neither is a spec-listed audit subject.
 * `community`/`plans` were added alongside those new V1 features (not
 * part of the original spec -- see PRODUCTION_READINESS.md's "New V1
 * features" section) with the same content-admin-write audit-log
 * treatment as every other content collection above. */
export const AUDIT_COLLECTIONS = [
  'users',
  'announcements',
  'daily_verses',
  'songs',
  'events',
  'settings',
  'community',
  'plans',
] as const;
export type AuditCollection = (typeof AUDIT_COLLECTIONS)[number];

/** Roles allowed to log an admin action -- mirrors firestore.rules'
 * isHostOrAbove(): a member never performs any of the actions this log
 * records, so a member caller is rejected outright. */
const ALLOWED_ROLES = new Set(['host', 'content_admin', 'super_admin']);

/** What the client actually sends. Deliberately has no admin_id/admin_email
 * field -- there is nothing for the client to supply there, by construction,
 * the same pattern createUserProfile.ts uses for `role`. */
export interface LogAdminActionInput {
  action: AuditAction;
  collection: AuditCollection;
  documentId: string;
  changeSummary: string;
  details?: Record<string, unknown>;
}

/** The subset of a callable request's verified auth context this handler
 * actually reads -- narrow on purpose so it's trivial to unit-test with a
 * plain object instead of a real CallableRequest. */
export interface CallerAuthContext {
  uid: string;
  email: string | null;
}

function isValidInput(data: unknown): data is LogAdminActionInput {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.action === 'string' &&
    (AUDIT_ACTIONS as readonly string[]).includes(d.action) &&
    typeof d.collection === 'string' &&
    (AUDIT_COLLECTIONS as readonly string[]).includes(d.collection) &&
    typeof d.documentId === 'string' &&
    d.documentId.length > 0 &&
    typeof d.changeSummary === 'string' &&
    d.changeSummary.length > 0 &&
    (d.details === undefined || (typeof d.details === 'object' && d.details !== null))
  );
}

/**
 * The actual logic, exported separately from the onCall wrapper below so it
 * can be unit-tested directly against a real Firestore emulator via
 * FIRESTORE_EMULATOR_HOST, the same pattern createUserProfile.ts uses. See
 * logAdminAction.test.ts.
 */
export async function logAdminActionHandler(
  data: unknown,
  auth: CallerAuthContext | undefined
): Promise<{ logged: true }> {
  if (!auth) {
    throw new AdminActionError(
      'unauthenticated',
      'You must be signed in to perform this action.'
    );
  }

  if (!isValidInput(data)) {
    throw new AdminActionError(
      'invalid-argument',
      'action, collection, documentId, and changeSummary are required and must be valid.'
    );
  }

  const db = getFirestore();
  const callerSnapshot = await db.collection('users').doc(auth.uid).get();
  const callerRole = callerSnapshot.exists
    ? (callerSnapshot.data()?.role as string | undefined)
    : undefined;

  if (!callerRole || !ALLOWED_ROLES.has(callerRole)) {
    throw new AdminActionError(
      'permission-denied',
      'Your account is not authorized to log admin actions.'
    );
  }

  await db.collection('audit_log').add({
    timestamp: FieldValue.serverTimestamp(),
    // Always derived from verified auth, never from `data` -- a client
    // cannot claim to be a different admin than the one it authenticated as.
    admin_id: auth.uid,
    admin_email: auth.email,
    action: data.action,
    collection: data.collection,
    document_id: data.documentId,
    change_summary: data.changeSummary,
    ...(data.details !== undefined ? { details: data.details } : {}),
  });

  return { logged: true };
}
