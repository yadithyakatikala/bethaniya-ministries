/**
 * Admin data layer for Notifications (Day 10) -- calls the sendNotification
 * callable Cloud Function (functions/src/sendNotification.ts) to send, and
 * subscribes to the read-only /notifications_log collection it writes to
 * (see firestore.rules' notifications_log rule: Cloud-Functions-write-only,
 * Host+ read-only) to show past notifications, mirroring
 * ../auditLog.ts's callable pattern and ./announcements.ts's
 * subscribe-to-a-collection pattern respectively.
 *
 * `estimateRecipientCount` below is a client-side-only convenience for the
 * confirmation dialog (NotificationsPage.tsx) -- it can fail with
 * permission-denied for a Host caller, because firestore.rules' users/
 * {userId} read rule is `isOwner(userId) || isContentAdminOrAbove()`, and
 * isContentAdminOrAbove() does NOT include host (a Host may only read
 * their own /users doc, not list the whole collection), even though Hosts
 * ARE allowed to send notifications per the RBAC table. That failure is
 * caught and surfaces as `null` (see NotificationsPage.tsx's confirmation
 * dialog, which then tells the user the count isn't available client-side
 * and will show up in the log after sending) rather than blocking the
 * send -- the *real*, authoritative recipient count is always computed
 * server-side by sendNotificationHandler itself (Admin SDK bypasses this
 * rule entirely) and is what actually gets stored in notifications_log.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  collection,
  getCountFromServer,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, functions, storage } from './app';
import type { NotificationLogEntry, NotificationRecipientGroup } from '../../types';

const NOTIFICATIONS_LOG_COLLECTION = 'notifications_log';

/** Mirrors functions/src/sendNotification.ts's ADMIN_ROLES exactly. */
const ADMIN_ROLES = ['host', 'content_admin', 'super_admin'];

interface SendNotificationCallableInput {
  title: string;
  message: string;
  imageUrl: string | null;
  recipientGroup: NotificationRecipientGroup;
}

interface SendNotificationCallableResult {
  sent: true;
  recipientCount: number;
}

const callSendNotification = httpsCallable<
  SendNotificationCallableInput,
  SendNotificationCallableResult
>(functions, 'sendNotification');

export async function sendNotification(
  input: SendNotificationCallableInput
): Promise<{ recipientCount: number }> {
  const result = await callSendNotification(input);
  return { recipientCount: result.data.recipientCount };
}

/**
 * Best-effort client-side count for the confirmation dialog -- returns
 * null (rather than throwing) when the caller cannot list /users
 * directly. See this module's header comment for why that happens for a
 * Host caller specifically, and why it's not a problem: the real count is
 * always computed server-side regardless.
 */
export async function estimateRecipientCount(
  group: NotificationRecipientGroup
): Promise<number | null> {
  try {
    const usersCollection = collection(db, 'users');
    const target =
      group === 'admins_only'
        ? query(usersCollection, where('role', 'in', ADMIN_ROLES))
        : query(usersCollection);
    const snapshot = await getCountFromServer(target);
    return snapshot.data().count;
  } catch {
    return null;
  }
}

function toNotificationLogEntry(
  id: string,
  data: Record<string, unknown>
): NotificationLogEntry {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    message: typeof data.message === 'string' ? data.message : '',
    imageUrl: typeof data.image_url === 'string' ? data.image_url : null,
    recipientGroup:
      data.recipient_group === 'admins_only' ? 'admins_only' : 'all_members',
    recipientCount: typeof data.recipient_count === 'number' ? data.recipient_count : 0,
    sentBy: typeof data.sent_by === 'string' ? data.sent_by : '',
    sentByEmail: typeof data.sent_by_email === 'string' ? data.sent_by_email : null,
    sentAt: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : null,
  };
}

/**
 * Subscribes to every notification ever sent, newest first -- Host/Content
 * Admin/Super Admin can all read (firestore.rules' notifications_log
 * read rule is isHostOrAbove()); a Member is denied, but this page is
 * never rendered for a Member in the first place (see
 * NotificationsPage.tsx's own role gate).
 */
export function subscribeToNotificationLog(
  onNext: (entries: NotificationLogEntry[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, NOTIFICATIONS_LOG_COLLECTION),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) =>
      onNext(snapshot.docs.map((d) => toNotificationLogEntry(d.id, d.data()))),
    onError
  );
}

/**
 * Uploads a notification image to Storage and returns its download URL.
 * Reuses the exact same content/{imageType}/{fileName} Storage path/rule
 * announcements/daily-verses/songs already use (storage.rules'
 * isContentAdminOrAbove() write check) -- NOT extended to Hosts, matching
 * that existing rule exactly, which is why NotificationsPage.tsx hides
 * the image field entirely for a Host caller rather than showing it and
 * failing the upload.
 */
export async function uploadNotificationImage(file: File): Promise<string> {
  const path = `content/notifications/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
