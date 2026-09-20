/**
 * Reporting content -- M7.
 *
 * =====================================================================
 * A MEMBER WRITES A REPORT AND NEVER READS ONE
 * =====================================================================
 * firestore.rules gives /reports a read rule of isContentAdminOrAbove()
 * and nothing else -- not even the person who filed it. That is
 * deliberate: a queue a reporter can read back is a queue that tells them
 * whether anybody else has reported the same person, which is not
 * something the congregation should be able to find out about each other.
 *
 * What the app owes the reporter is an answer to "did that work", and it
 * gets that from their OWN marker document instead:
 *
 *   users/{uid}/reportedItems/{targetType}_{targetId}
 *
 * The id is deterministic, so reporting the same thing twice is
 * unrepresentable rather than merely discouraged -- the same reasoning as
 * ./media.ts's likes and saves. Reading the set costs one read for a
 * whole screen.
 *
 * =====================================================================
 * THE SCHEMA
 * =====================================================================
 *   reports/{reportId}
 *     targetType      'media' | 'media_comment' | 'community_message'
 *                     | 'prayer_request'
 *     targetId        the reported document's id
 *     targetParentId  the post a reported comment belongs to, else null
 *     reason          one of REPORT_REASONS
 *     details         optional free text from the reporter
 *     reporterUid     pinned to the caller by rules
 *     createdAt
 *     status          'open' | 'resolved' | 'dismissed'
 *     resolvedByUid / resolvedAt / resolutionNote   the administrator's
 *
 * A report is created `open` and cannot arrive otherwise; rules refuse
 * the three resolution fields on creation and let only an administrator
 * write them afterwards.
 *
 * =====================================================================
 * REPORTING AN ANONYMOUS PRAYER REQUEST
 * =====================================================================
 * A report names the REQUEST, never its author, because the device has no
 * author to name -- see ./prayerRequests.ts. An administrator reviewing
 * it sees the words that were reported and can remove them; only a super
 * admin can look up who wrote them, through
 * prayer_requests/{id}/private/author. Reporting somebody does not
 * de-anonymise them.
 */
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './app';

export const REPORTS_COLLECTION = 'reports';
export const REPORTED_ITEMS_SUBCOLLECTION = 'reportedItems';
export const MAX_REPORT_DETAILS_LENGTH = 1000;

/** Matches firestore.rules' isValidReport(). */
export const REPORT_TARGET_TYPES = [
  'media',
  'media_comment',
  'community_message',
  'prayer_request',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'misinformation',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * The marker document's id. Deterministic, so the same target can only
 * ever be reported once by the same member -- see this file's header.
 *
 * Exported because the screens build the key to look a target up in the
 * set fetchReportedItemKeys() returns, and a second spelling of this
 * would silently stop matching.
 */
export function reportedItemKey(targetType: ReportTargetType, targetId: string): string {
  return `${targetType}_${targetId}`;
}

/** Everything this member has already reported. One read per screen. */
export async function fetchReportedItemKeys(uid: string): Promise<Set<string>> {
  const snapshot = await getDocs(
    collection(db, 'users', uid, REPORTED_ITEMS_SUBCOLLECTION)
  );
  return new Set(snapshot.docs.map((d) => d.id));
}

export interface NewReport {
  reporterUid: string;
  targetType: ReportTargetType;
  targetId: string;
  /** The media post a reported comment belongs to. Null otherwise. */
  targetParentId?: string | null;
  reason: ReportReason;
  details?: string;
}

/**
 * Files a report, and records the member's own marker for it.
 *
 * NOT a batch, unlike ./prayerRequests.ts's create. The two writes go to
 * collections with different rules, and the important one is the report:
 * if the marker write fails the report still stands and the member can
 * file it again, which is harmless. If they were batched, a marker
 * failure would throw away a legitimate report.
 */
export async function submitReport(input: NewReport): Promise<void> {
  const details = input.details?.trim() ?? '';
  await addDoc(collection(db, REPORTS_COLLECTION), {
    targetType: input.targetType,
    targetId: input.targetId,
    targetParentId: input.targetParentId ?? null,
    reason: input.reason,
    details: details.length > 0 ? details : null,
    reporterUid: input.reporterUid,
    createdAt: serverTimestamp(),
    status: 'open',
  });

  await setDoc(
    doc(
      db,
      'users',
      input.reporterUid,
      REPORTED_ITEMS_SUBCOLLECTION,
      reportedItemKey(input.targetType, input.targetId)
    ),
    { createdAt: serverTimestamp() }
  );
}

/**
 * Shared with the admin dashboard's queue only through the field names
 * above -- the two packages have no common module (see
 * ../../features/media/mediaUrl.ts's note about the same split), so the
 * admin side declares its own reader in admin/src/services/firebase/
 * reports.ts and both sides' tests assert the same shape.
 */
export function toReportCreatedAt(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}
