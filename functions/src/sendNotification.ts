/**
 * sendNotification -- Day 10, the admin "Send Notification" action
 * (FINAL_ARCHITECTURE_SPECIFICATION.md's Notifications page: "Compose
 * notification: title + message + optional image, Recipient selector:
 * All Members / Admins Only, Send button + confirmation, Notification log
 * (view past sent)").
 *
 * Callable, following the exact same architecture as ./logAdminAction.ts
 * (see that file's header comment for the full "why callable, not a
 * Firestore trigger" reasoning, which applies identically here -- only a
 * callable gets a verified, unforgeable caller identity, and that identity
 * is what decides whether the caller may send at all). Same plain-Error-
 * subclass-not-HttpsError pattern for the same reason (this file never
 * imports 'firebase-functions/v2/https', which would otherwise crash Jest
 * the way healthCheck.ts's own Day 1 notes describe); index.ts's onCall
 * wrapper converts it into a real HttpsError for actual callable clients.
 *
 * Per FINAL_ARCHITECTURE_SPECIFICATION.md's RBAC table ("Content Admin —
 * Manage ... notifications", "Host — Manage live stream + send
 * notifications", Super Admin has full access), the same three roles
 * allowed to call logAdminAction may call this: host, content_admin,
 * super_admin. A member is rejected, matching the RBAC table's
 * `notifications_log` row ("Member: None").
 *
 * HONESTLY DISCLOSED LIMITATION -- this function does NOT deliver an
 * actual FCM push notification. Real delivery requires a registered FCM
 * device token per recipient; this project has never built push-token
 * registration on the mobile side (see
 * mobile/src/services/notifications/notificationService.ts's own header
 * comment, which discloses the identical limitation from the client side:
 * no live Firebase project exists, nothing notification-related has ever
 * been tested against real delivery, and none of that is buildable while
 * the ₹0/no-Blaze constraint holds -- Cloud Messaging delivery itself is
 * free, but this repo has no registered tokens to send to regardless).
 * What decision 12/13 actually asked for, and what IS fully buildable and
 * emulator-testable at ₹0 today, is the rest of it: authenticate +
 * authorize the caller, validate the payload, compute a real recipient
 * count from real Firestore data, and write an immutable /notifications_log
 * entry recording what was "sent" and to how many recipients -- exactly
 * the server-side audit trail the spec's RBAC table already reserves a
 * `notifications_log` collection for (Cloud Functions write-only, Host+
 * read-only -- see firestore.rules, already in place before this file
 * existed). admin/src/features/notifications/NotificationsPage.tsx's
 * header comment covers the client side of this same disclosure.
 */
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

export class SendNotificationError extends Error {
  constructor(
    public readonly code: 'unauthenticated' | 'invalid-argument' | 'permission-denied',
    message: string
  ) {
    super(message);
    this.name = 'SendNotificationError';
  }
}

/**
 * "All Members" broadcasts to every registered user (the whole
 * congregation -- admins are members of the congregation too, this isn't
 * a filter on the `member` role literal). "Admins Only" narrows to the
 * same role set ALLOWED_ROLES below grants send-access to, for
 * internal/staff-only notices. See NotificationsPage.tsx's header comment
 * for the same interpretation stated on the client side.
 */
export const RECIPIENT_GROUPS = ['all_members', 'admins_only'] as const;
export type RecipientGroup = (typeof RECIPIENT_GROUPS)[number];

/** Mirrors logAdminAction.ts's ALLOWED_ROLES exactly -- same three roles, same reasoning. */
const ALLOWED_ROLES = new Set(['host', 'content_admin', 'super_admin']);
const ADMIN_ROLES = ['host', 'content_admin', 'super_admin'];

/** Matches announcements' title cap (firestore.rules' isValidAnnouncement()) for consistency, though notifications_log has no rules-level shape validation of its own (Cloud-Functions-only writes, per firestore.rules' `allow write: if false`). */
const TITLE_MAX_LENGTH = 200;
/** A reasonable push-notification-body length cap, not a hard platform limit -- chosen for this project, not derived from an existing rule (there is no isValidNotification() in firestore.rules to mirror). */
const MESSAGE_MAX_LENGTH = 1000;

export interface SendNotificationInput {
  title: string;
  message: string;
  imageUrl?: string | null;
  recipientGroup: RecipientGroup;
}

/** The subset of a callable request's verified auth context this handler
 * actually reads -- same narrowing as logAdminAction.ts's CallerAuthContext,
 * for the same testability reason. */
export interface CallerAuthContext {
  uid: string;
  email: string | null;
}

function isValidInput(data: unknown): data is SendNotificationInput {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.title === 'string' &&
    d.title.trim().length > 0 &&
    d.title.trim().length <= TITLE_MAX_LENGTH &&
    typeof d.message === 'string' &&
    d.message.trim().length > 0 &&
    d.message.trim().length <= MESSAGE_MAX_LENGTH &&
    (d.imageUrl === undefined || d.imageUrl === null || typeof d.imageUrl === 'string') &&
    typeof d.recipientGroup === 'string' &&
    (RECIPIENT_GROUPS as readonly string[]).includes(d.recipientGroup)
  );
}

/**
 * The actual logic, exported separately from the onCall wrapper below so it
 * can be unit-tested directly against a real Firestore emulator via
 * FIRESTORE_EMULATOR_HOST -- same pattern as logAdminActionHandler. See
 * sendNotification.test.ts.
 */
export async function sendNotificationHandler(
  data: unknown,
  auth: CallerAuthContext | undefined
): Promise<{ sent: true; recipientCount: number }> {
  if (!auth) {
    throw new SendNotificationError(
      'unauthenticated',
      'You must be signed in to send notifications.'
    );
  }

  if (!isValidInput(data)) {
    throw new SendNotificationError(
      'invalid-argument',
      `title (1-${TITLE_MAX_LENGTH} chars), message (1-${MESSAGE_MAX_LENGTH} chars), ` +
        "and a valid recipientGroup ('all_members' or 'admins_only') are required."
    );
  }

  const db = getFirestore();
  const callerSnapshot = await db.collection('users').doc(auth.uid).get();
  const callerRole = callerSnapshot.exists
    ? (callerSnapshot.data()?.role as string | undefined)
    : undefined;

  if (!callerRole || !ALLOWED_ROLES.has(callerRole)) {
    throw new SendNotificationError(
      'permission-denied',
      'Your account is not authorized to send notifications.'
    );
  }

  const title = data.title.trim();
  const message = data.message.trim();
  const imageUrl = data.imageUrl ?? null;

  // Real recipient count, computed server-side via the Admin SDK, which
  // bypasses the firestore.rules read restriction that keeps a Host from
  // listing /users directly (firestore.rules' users/{userId} read rule is
  // isOwner(userId) || isContentAdminOrAbove() -- isContentAdminOrAbove()
  // does NOT include host, so a Host caller could not compute this count
  // client-side even though Hosts are allowed to send). See
  // NotificationsPage.tsx's header comment for the client-side half of
  // this same boundary.
  const usersCollection = db.collection('users');
  const countSnapshot =
    data.recipientGroup === 'admins_only'
      ? await usersCollection.where('role', 'in', ADMIN_ROLES).count().get()
      : await usersCollection.count().get();
  const recipientCount = countSnapshot.data().count;

  await db.collection('notifications_log').add({
    timestamp: FieldValue.serverTimestamp(),
    // Always derived from verified auth, never from `data` -- same
    // never-trust-the-client-identity principle logAdminActionHandler
    // applies to admin_id/admin_email.
    sent_by: auth.uid,
    sent_by_email: auth.email,
    title,
    message,
    image_url: imageUrl,
    recipient_group: data.recipientGroup,
    recipient_count: recipientCount,
  });

  return { sent: true, recipientCount };
}
