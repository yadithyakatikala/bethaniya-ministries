/**
 * The moderation queue -- M7.
 *
 * =====================================================================
 * WHAT AN ADMINISTRATOR CAN DO, AND WHAT THEY DELIBERATELY CANNOT
 * =====================================================================
 * A content admin reviewing this queue can read the reported content,
 * remove it, and resolve or dismiss the report. They CANNOT learn who
 * wrote an anonymous prayer request: that identity lives in
 * prayer_requests/{id}/private/author, which firestore.rules opens to the
 * author and to a SUPER admin only. Moderation does not require identity,
 * and the brief permits only the super admin to have it -- so this module
 * has no function that reads it, and adding one would be a deliberate
 * change rather than an oversight.
 *
 * =====================================================================
 * REMOVAL IS SOFT FOR MEMBER-AUTHORED CONTENT
 * =====================================================================
 * A chat message and a prayer request are flagged `removed`, not deleted:
 * the app shows a tombstone in their place, and the report in this queue
 * keeps pointing at something an administrator can still read. A hard
 * delete would take the evidence out of the hands of the next person to
 * review it.
 *
 * A media COMMENT is the exception -- it is hard-deleted, because
 * firestore.rules has never allowed a comment to be updated by anyone
 * (see that file's media/{mediaId}/comments block and why an editable
 * comment is itself a moderation problem). A media POST is unpublished
 * through the existing ./media.ts controls rather than duplicated here.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './app';
import { logAdminAction } from './auditLog';

const REPORTS_COLLECTION = 'reports';
const COMMUNITY_MESSAGES_COLLECTION = 'community_messages';
const PRAYER_REQUESTS_COLLECTION = 'prayer_requests';
const MEDIA_COLLECTION = 'media';

/** Kept in sync with mobile/src/services/firebase/reports.ts. */
export type ReportTargetType =
  | 'media'
  | 'media_comment'
  | 'community_message'
  | 'prayer_request';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'misinformation'
  | 'other';

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface ReportRecord {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  /** The media post a reported comment belongs to. */
  targetParentId: string | null;
  reason: ReportReason;
  details: string | null;
  reporterUid: string;
  createdAt: Date | null;
  status: ReportStatus;
  resolvedByUid: string | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
}

/** What was actually said, fetched on demand when a report is opened. */
export interface ReportedContent {
  /** The words. Empty when the document is gone. */
  text: string;
  /** The author's name, or null -- an anonymous request has none. */
  authorName: string | null;
  /** Already removed by a previous review. */
  removed: boolean;
  /** The document no longer exists (its author deleted it). */
  missing: boolean;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam or advertising',
  harassment: 'Harassment or bullying',
  hate: 'Hateful language',
  sexual: 'Sexual content',
  violence: 'Violence or threats',
  misinformation: 'False information',
  other: 'Something else',
};

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  media: 'Media post',
  media_comment: 'Comment',
  community_message: 'Chat message',
  prayer_request: 'Prayer request',
};

function asDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

export function toReportRecord(id: string, data: Record<string, unknown>): ReportRecord {
  return {
    id,
    targetType: (data.targetType as ReportTargetType) ?? 'media',
    targetId: typeof data.targetId === 'string' ? data.targetId : '',
    targetParentId:
      typeof data.targetParentId === 'string' ? data.targetParentId : null,
    reason: (data.reason as ReportReason) ?? 'other',
    details: typeof data.details === 'string' ? data.details : null,
    reporterUid: typeof data.reporterUid === 'string' ? data.reporterUid : '',
    createdAt: asDate(data.createdAt),
    status: (data.status as ReportStatus) ?? 'open',
    resolvedByUid: typeof data.resolvedByUid === 'string' ? data.resolvedByUid : null,
    resolvedAt: asDate(data.resolvedAt),
    resolutionNote: typeof data.resolutionNote === 'string' ? data.resolutionNote : null,
  };
}

/**
 * The queue, newest first.
 *
 * A LIVE subscription, unlike ./users.ts's one-time fetch -- two
 * administrators working through a queue at the same time should not each
 * be reviewing a report the other has already closed. A single-field sort
 * on `createdAt`, so Firestore's automatic index covers it; the
 * open-only filter below is applied in the page rather than in the query
 * for the same reason.
 */
export function subscribeToReports(
  onNext: (reports: ReportRecord[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, REPORTS_COLLECTION), orderBy('createdAt', 'desc')),
    (snapshot) => onNext(snapshot.docs.map((d) => toReportRecord(d.id, d.data()))),
    onError
  );
}

/** Only the open ones, for a dashboard count. */
export function subscribeToOpenReportCount(
  onNext: (count: number) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, REPORTS_COLLECTION), where('status', '==', 'open')),
    (snapshot) => onNext(snapshot.size),
    onError
  );
}

function refFor(report: ReportRecord) {
  switch (report.targetType) {
    case 'community_message':
      return doc(db, COMMUNITY_MESSAGES_COLLECTION, report.targetId);
    case 'prayer_request':
      return doc(db, PRAYER_REQUESTS_COLLECTION, report.targetId);
    case 'media':
      return doc(db, MEDIA_COLLECTION, report.targetId);
    case 'media_comment':
      // A comment is a subcollection document, so the post it belongs to
      // is required to address it -- which is why a report of a comment
      // carries targetParentId.
      return report.targetParentId
        ? doc(db, MEDIA_COLLECTION, report.targetParentId, 'comments', report.targetId)
        : null;
  }
}

/**
 * The reported content itself.
 *
 * Returns `missing: true` rather than throwing when the document is gone
 * -- an author deleting their own message between the report and the
 * review is an ordinary outcome, and the report still has to be
 * closeable.
 */
export async function fetchReportedContent(
  report: ReportRecord
): Promise<ReportedContent> {
  const ref = refFor(report);
  if (!ref) return { text: '', authorName: null, removed: false, missing: true };

  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return { text: '', authorName: null, removed: false, missing: true };
  }
  const data = snapshot.data();

  // Each collection keeps its words under a different field name, and
  // there is no shared shape to lean on -- a prayer request has a title
  // and a body, a chat message has text, a media post has a caption.
  const text =
    report.targetType === 'prayer_request'
      ? [data.title, data.body].filter((part) => typeof part === 'string').join('\n\n')
      : report.targetType === 'media'
        ? typeof data.caption === 'string'
          ? data.caption
          : ''
        : typeof data.text === 'string'
          ? data.text
          : '';

  return {
    text,
    // An anonymous prayer request has no authorName field at all, by
    // design -- see firestore.rules' isValidPrayerRequest(). null here
    // means "not knowable from this document", and the page says
    // "Anonymous" rather than leaving a blank.
    authorName: typeof data.authorName === 'string' ? data.authorName : null,
    removed: data.removed === true,
    missing: false,
  };
}

/**
 * Takes the reported content down.
 *
 * Soft for a chat message and a prayer request; a hard delete for a media
 * comment, which rules make immutable. A media POST is not handled here
 * -- it is unpublished from the media page, which already has that
 * control and its own audit entry.
 */
export async function removeReportedContent(
  report: ReportRecord,
  adminUid: string
): Promise<void> {
  const ref = refFor(report);
  if (!ref) throw new Error('This report does not point at anything removable.');

  if (report.targetType === 'media_comment') {
    await deleteDoc(ref);
  } else if (report.targetType === 'media') {
    await updateDoc(ref, { published: false, updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, {
      removed: true,
      removedAt: serverTimestamp(),
      removedByUid: adminUid,
    });
  }

  await logAdminAction({
    action: report.targetType === 'media' ? 'unpublish' : 'delete',
    collection:
      report.targetType === 'community_message'
        ? 'community_messages'
        : report.targetType === 'prayer_request'
          ? 'prayer_requests'
          : 'media',
    documentId: report.targetId,
    changeSummary: `Removed reported ${REPORT_TARGET_LABELS[report.targetType].toLowerCase()}`,
  });
}

/**
 * Closes a report.
 *
 * `resolvedByUid` must be the caller -- firestore.rules enforces it, so
 * passing somebody else's uid fails rather than silently recording the
 * wrong administrator.
 */
export async function resolveReport(
  reportId: string,
  adminUid: string,
  status: 'resolved' | 'dismissed',
  note: string
): Promise<void> {
  const trimmed = note.trim();
  await updateDoc(doc(db, REPORTS_COLLECTION, reportId), {
    status,
    resolvedByUid: adminUid,
    resolvedAt: serverTimestamp(),
    resolutionNote: trimmed.length > 0 ? trimmed : null,
  });
  await logAdminAction({
    action: 'update',
    collection: 'reports',
    documentId: reportId,
    changeSummary: status === 'resolved' ? 'Resolved a report' : 'Dismissed a report',
  });
}
