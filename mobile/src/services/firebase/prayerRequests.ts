/**
 * The shared prayer wall -- M7.
 *
 * =====================================================================
 * THIS IS NOT ./prayers.ts, AND THE TWO DO NOT OVERLAP
 * =====================================================================
 * ./prayers.ts is a member's PRIVATE journal at users/{uid}/prayers --
 * only they can read it, there is no admin override, and M7 does not
 * touch it. This module is the opposite thing: a request the member asks
 * the whole church to pray for. Different collection, different
 * permissions, different screen. A member can use one, the other, or
 * both.
 *
 * =====================================================================
 * THE SCHEMA
 * =====================================================================
 *   prayer_requests/{requestId}
 *     title        what the request is, in a line
 *     body         the detail
 *     category     one of PRAYER_CATEGORIES, or null
 *     anonymous    whether the author is shown
 *     authorUid    ONLY when anonymous is false
 *     authorName   ONLY when anonymous is false
 *     status       'open' | 'answered' | 'closed'
 *     createdAt / updatedAt
 *     removed      set by an administrator; the app shows a tombstone
 *
 *   prayer_requests/{requestId}/private/author   { uid, createdAt }
 *   users/{uid}/prayerRequests/{requestId}       { createdAt, anonymous }
 *
 * =====================================================================
 * WHAT "ANONYMOUS" MEANS HERE -- AND WHAT IT WOULD HAVE MEANT IF DONE
 * THE EASY WAY
 * =====================================================================
 * The easy way is to keep `authorUid` on every request and have the UI
 * render "Anonymous" when the flag is set. That is not anonymity. Every
 * signed-in member can read this collection, so anything in the document
 * is something they can read with the SDK, a REST call, or the emulator
 * UI, whatever the app chooses to draw. The flag would protect the author
 * from other members' eyes and from nobody else's.
 *
 * So an anonymous request carries NO identity at all. firestore.rules'
 * isValidPrayerRequest() refuses the write if it does. There is no uid to
 * leak into a navigation param, an analytics event, a log line, an
 * accessibility label or a share payload, because the value never reaches
 * the device in the first place.
 *
 * The author still has to be able to edit and delete their own request,
 * so their identity is written once into
 * prayer_requests/{requestId}/private/author, which only they and a SUPER
 * admin can read (the explicit, documented moderation path). A content
 * admin can remove an abusive request without ever learning who wrote it.
 *
 * Finding out which requests are yours would still be one read per row
 * against that private document, so the member also gets their own index
 * at users/{uid}/prayerRequests -- one read for the whole screen, in
 * their own space. Same shape as users/{uid}/mediaLikes in ./media.ts.
 *
 * All three documents are written in ONE batch: a request whose private
 * author document failed to write would be one nobody could ever edit or
 * delete.
 *
 * =====================================================================
 * PAGINATION, NOT A LISTENER
 * =====================================================================
 * A prayer wall is read, not watched. Pages of PRAYER_REQUESTS_PAGE_SIZE,
 * newest first, with pull-to-refresh -- the same decision ./media.ts made
 * for the feed and for the same reason: a live listener over a growing
 * collection is a read every time anything in it changes.
 */
import {
  type DocumentData,
  type QueryDocumentSnapshot,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './app';

export const PRAYER_REQUESTS_COLLECTION = 'prayer_requests';
export const PRAYER_REQUESTS_INDEX_SUBCOLLECTION = 'prayerRequests';
export const PRAYER_REQUESTS_PAGE_SIZE = 15;

export const MAX_PRAYER_TITLE_LENGTH = 200;
export const MAX_PRAYER_BODY_LENGTH = 5000;

/**
 * The closed set of categories, matching firestore.rules'
 * isValidPrayerRequest(). Ids, never display text -- the labels are in
 * ../../i18n/strings.ts, because these are shown to Telugu speakers too.
 */
export const PRAYER_CATEGORIES = [
  'healing',
  'family',
  'guidance',
  'thanksgiving',
  'provision',
  'other',
] as const;
export type PrayerCategory = (typeof PRAYER_CATEGORIES)[number];

export const PRAYER_STATUSES = ['open', 'answered', 'closed'] as const;
export type PrayerRequestStatus = (typeof PRAYER_STATUSES)[number];

export interface PrayerRequest {
  id: string;
  title: string;
  body: string;
  category: PrayerCategory | null;
  anonymous: boolean;
  /**
   * The author's display name, or `null` for an anonymous request.
   *
   * NULL IS NOT "UNKNOWN TO THIS SCREEN" -- it is unknown to the device.
   * See this file's header. The UI renders the "Anonymous" label from the
   * i18n catalogue rather than from anything stored.
   */
  authorName: string | null;
  status: PrayerRequestStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** An administrator removed it. The list shows a tombstone. */
  removed: boolean;
}

export interface PrayerRequestPage {
  requests: PrayerRequest[];
  /** Opaque; hand it back to fetchPrayerRequestPage. `null` at the end. */
  cursor: PrayerRequestCursor | null;
}

export type PrayerRequestCursor = QueryDocumentSnapshot<DocumentData>;

function asCategory(value: unknown): PrayerCategory | null {
  return typeof value === 'string' && (PRAYER_CATEGORIES as readonly string[]).includes(value)
    ? (value as PrayerCategory)
    : null;
}

function asStatus(value: unknown): PrayerRequestStatus {
  return typeof value === 'string' && (PRAYER_STATUSES as readonly string[]).includes(value)
    ? (value as PrayerRequestStatus)
    : 'open';
}

function asDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

export function toPrayerRequest(
  id: string,
  data: Record<string, unknown>
): PrayerRequest | null {
  const { title, body } = data;
  // A request with no words is not a request. Skipped rather than
  // rendered as an empty card -- same decision as toMediaPost().
  if (typeof title !== 'string' || title.trim().length === 0) return null;
  if (typeof body !== 'string' || body.trim().length === 0) return null;

  const anonymous = data.anonymous === true;
  return {
    id,
    title: title.trim(),
    body: body.trim(),
    category: asCategory(data.category),
    anonymous,
    // Belt and braces: rules already refuse an anonymous request that
    // carries a name, and this refuses to read one back if a document
    // written before those rules existed somehow has one.
    authorName:
      !anonymous && typeof data.authorName === 'string' && data.authorName.trim().length > 0
        ? data.authorName.trim()
        : null,
    status: asStatus(data.status),
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    removed: data.removed === true,
  };
}

function pageQuery(cursor: PrayerRequestCursor | null, pageSize: number) {
  return query(
    collection(db, PRAYER_REQUESTS_COLLECTION),
    orderBy('createdAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize)
  );
}

/**
 * One page of requests, newest first.
 *
 * Removed requests are returned rather than filtered out, so the list
 * does not silently renumber itself under a member who was reading it --
 * the row becomes a tombstone in place. Filtering server-side would also
 * need a composite index and would hide the moderation from the person
 * who reported it.
 */
export async function fetchPrayerRequestPage(
  options: { cursor?: PrayerRequestCursor | null; pageSize?: number } = {}
): Promise<PrayerRequestPage> {
  const { cursor = null, pageSize = PRAYER_REQUESTS_PAGE_SIZE } = options;
  const snapshot = await getDocs(pageQuery(cursor, pageSize));
  const requests = snapshot.docs
    .map((d) => toPrayerRequest(d.id, d.data()))
    .filter((request): request is PrayerRequest => request !== null);
  const last = snapshot.docs[snapshot.docs.length - 1];
  return {
    requests,
    // A short page means there is nothing more to ask for; handing a
    // cursor back anyway costs one empty read per scroll to the bottom.
    cursor: snapshot.docs.length < pageSize ? null : (last ?? null),
  };
}

export async function fetchPrayerRequest(requestId: string): Promise<PrayerRequest | null> {
  const snapshot = await getDoc(doc(db, PRAYER_REQUESTS_COLLECTION, requestId));
  if (!snapshot.exists()) return null;
  return toPrayerRequest(snapshot.id, snapshot.data());
}

/**
 * The ids of every request this member wrote, anonymous ones included.
 *
 * ONE read for the whole screen. See this file's header for why the
 * alternative -- reading each request's private author document -- is not
 * what the app does.
 */
export async function fetchOwnPrayerRequestIds(uid: string): Promise<Set<string>> {
  const snapshot = await getDocs(
    collection(db, 'users', uid, PRAYER_REQUESTS_INDEX_SUBCOLLECTION)
  );
  return new Set(snapshot.docs.map((d) => d.id));
}

export interface NewPrayerRequest {
  uid: string;
  /** Ignored entirely when `anonymous` is true. */
  authorName: string;
  title: string;
  body: string;
  category: PrayerCategory | null;
  anonymous: boolean;
}

/**
 * Publishes a request, its private author record and the member's own
 * index entry as ONE atomic write.
 *
 * The identity fields are OMITTED, not nulled, for an anonymous request:
 * firestore.rules refuses the write if `authorUid` or `authorName` is
 * present at all, which is what makes the anonymity a property of the
 * document rather than a promise the client makes.
 */
export async function createPrayerRequest(input: NewPrayerRequest): Promise<string> {
  const { uid, authorName, title, body, category, anonymous } = input;
  const requestRef = doc(collection(db, PRAYER_REQUESTS_COLLECTION));

  const batch = writeBatch(db);
  batch.set(requestRef, {
    title: title.trim(),
    body: body.trim(),
    category,
    anonymous,
    ...(anonymous ? {} : { authorUid: uid, authorName: authorName.trim() }),
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    removed: false,
  });
  batch.set(doc(requestRef, 'private', 'author'), {
    uid,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'users', uid, PRAYER_REQUESTS_INDEX_SUBCOLLECTION, requestRef.id), {
    createdAt: serverTimestamp(),
    anonymous,
  });
  await batch.commit();
  return requestRef.id;
}

/**
 * Edits a request the caller wrote.
 *
 * `anonymous` is deliberately absent from the payload and from the rules'
 * allowlist. A request published anonymously cannot be de-anonymised
 * afterwards, including by its own author -- by then other people have
 * responded to it on the understanding that it was anonymous.
 */
export async function updatePrayerRequest(
  requestId: string,
  fields: {
    title: string;
    body: string;
    category: PrayerCategory | null;
    status: PrayerRequestStatus;
  }
): Promise<void> {
  await updateDoc(doc(db, PRAYER_REQUESTS_COLLECTION, requestId), {
    title: fields.title.trim(),
    body: fields.body.trim(),
    category: fields.category,
    status: fields.status,
    updatedAt: serverTimestamp(),
  });
}

export async function setPrayerRequestStatus(
  requestId: string,
  status: PrayerRequestStatus
): Promise<void> {
  await updateDoc(doc(db, PRAYER_REQUESTS_COLLECTION, requestId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a request the caller wrote, and their index entry for it.
 *
 * The private author document is left behind deliberately: only a super
 * admin can delete it (firestore.rules), and an author deleting their own
 * request is not a moderation event that needs the record kept in sync.
 * It is a single tiny document per deleted request, readable by nobody
 * except a super admin, and removing the author's ability to delete their
 * own request rather than orphaning it would be the worse trade.
 */
export async function deleteOwnPrayerRequest(uid: string, requestId: string): Promise<void> {
  await deleteDoc(doc(db, PRAYER_REQUESTS_COLLECTION, requestId));
  await deleteDoc(doc(db, 'users', uid, PRAYER_REQUESTS_INDEX_SUBCOLLECTION, requestId));
}
