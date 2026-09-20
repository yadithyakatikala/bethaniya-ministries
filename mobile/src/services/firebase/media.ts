/**
 * The media feed: reading it, and a member's own interactions with it.
 *
 * =====================================================================
 * THE SCHEMA, AND WHY IT IS SHAPED THIS WAY
 * =====================================================================
 *   media/{mediaId}
 *     type          'image' | 'video'
 *     mediaUrl      an external https URL -- see
 *                   ../../features/media/mediaUrl.ts for what is allowed
 *                   and why nothing is ever uploaded
 *     caption       what the post says
 *     verseReference / verseText   optional, and optional SEPARATELY: a
 *                   post may cite "John 3:16" without quoting it
 *     published     an administrator has published it
 *     publishAt     the moment it becomes visible
 *     authorName    the administrator's display name, DENORMALIZED
 *     authorUid     who wrote it
 *     createdAt / updatedAt
 *
 * `authorName` is copied onto the post rather than looked up. A feed of
 * twenty posts would otherwise be twenty extra reads of /users, and
 * firestore.rules does not let a member read another member's profile
 * anyway -- so a lookup would not merely be slow, it would fail.
 *
 * VISIBILITY IS `published == true && publishAt <= now`, the same pair
 * the Prophet Verse uses (see ./prophetVerses.ts), enforced in
 * firestore.rules against the SERVER's clock. The query below supplies
 * its own bound from the device's clock and retries five minutes earlier
 * on a denial, for exactly the reason documented there: a fast phone
 * clock must not turn the whole feed into an error.
 *
 * =====================================================================
 * INTERACTIONS: USER-SCOPED, DETERMINISTIC, AND BOUNDED
 * =====================================================================
 *   users/{uid}/mediaLikes/{mediaId}
 *   users/{uid}/mediaSaves/{mediaId}
 *
 * The document id IS the media id. That is not a convenience -- it makes
 * "liked twice" unrepresentable, needs no query to check whether a member
 * has already liked something, and puts ownership in the PATH, so
 * firestore.rules enforces it with isOwner(userId) and no field-level
 * reasoning at all. Nobody can write to anybody else's.
 *
 * A save carries a small copy of the post (type, url, caption, publishAt)
 * so the Saved screen is ONE query instead of one query plus a read per
 * saved post. The copy can go stale if an administrator edits the
 * caption; the detail screen re-reads the real post, so the stale copy
 * only ever appears in a list.
 *
 * =====================================================================
 * THERE ARE NO LIKE COUNTS, DELIBERATELY
 * =====================================================================
 * A trustworthy counter needs a server to maintain it, and this project
 * has no deployable Cloud Functions on the Spark plan. The alternative --
 * letting clients increment a number on the post -- is a counter anyone
 * can inflate without liking anything, because rules cannot tie a write
 * on the post to a write in someone's own subcollection. A number that
 * can be made up is worse than no number, so the feed shows a member
 * their OWN like state and no total. This is a real limitation and it is
 * written down rather than papered over.
 *
 * =====================================================================
 * COMMENTS
 * =====================================================================
 *   media/{mediaId}/comments/{commentId}
 *
 * Public to read (they are part of the post), create and delete only by
 * their own author, never updatable -- an edited comment under someone
 * else's post is a moderation problem this app has no answer for, so it
 * is not offered. Paginated, capped in length, and never subscribed to
 * in real time from the feed.
 */
import {
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from './app';

export const MEDIA_COLLECTION = 'media';
export const MEDIA_LIKES_SUBCOLLECTION = 'mediaLikes';
export const MEDIA_SAVES_SUBCOLLECTION = 'mediaSaves';
export const MEDIA_COMMENTS_SUBCOLLECTION = 'comments';

/** Matches ./prophetVerses.ts -- see this file's header. */
export const CLOCK_SKEW_ALLOWANCE_MS = 5 * 60 * 1000;

/** One screenful. Small enough that opening the feed is cheap, large
 *  enough that the first scroll rarely needs a second page. */
export const MEDIA_PAGE_SIZE = 10;
export const COMMENTS_PAGE_SIZE = 20;
export const MAX_COMMENT_LENGTH = 1000;

export type MediaType = 'image' | 'video';

export interface MediaPost {
  id: string;
  type: MediaType;
  mediaUrl: string;
  caption: string;
  /** "John 3:16", as an administrator typed it. Never parsed -- a
   *  reference in a post is a label, not a link into the reader. */
  verseReference: string | null;
  verseText: string | null;
  authorName: string;
  publishAt: Date | null;
}

/** One page of the feed, plus the cursor to ask for the next one. */
export interface MediaPage {
  posts: MediaPost[];
  /** Opaque: hand it straight back to fetchMediaPage. `null` when this
   *  was the last page. */
  cursor: MediaCursor | null;
}

export type MediaCursor = QueryDocumentSnapshot<DocumentData>;

export function toMediaPost(id: string, data: Record<string, unknown>): MediaPost | null {
  const { mediaUrl, type } = data;
  // A post with no media is not a media post, and half of one is worse
  // than none: the feed skips it rather than rendering an empty card.
  if (typeof mediaUrl !== 'string' || !mediaUrl.startsWith('https://')) return null;
  if (type !== 'image' && type !== 'video') return null;

  const publishAt = data.publishAt;
  return {
    id,
    type,
    mediaUrl,
    caption: typeof data.caption === 'string' ? data.caption : '',
    verseReference:
      typeof data.verseReference === 'string' && data.verseReference.trim().length > 0
        ? data.verseReference.trim()
        : null,
    verseText:
      typeof data.verseText === 'string' && data.verseText.trim().length > 0
        ? data.verseText.trim()
        : null,
    authorName: typeof data.authorName === 'string' ? data.authorName : '',
    publishAt:
      publishAt instanceof Timestamp
        ? publishAt.toDate()
        : publishAt instanceof Date
          ? publishAt
          : null,
  };
}

function publishedQuery(notAfter: Date, cursor: MediaCursor | null, pageSize: number) {
  const constraints = [
    where('published', '==', true),
    where('publishAt', '<=', Timestamp.fromDate(notAfter)),
    orderBy('publishAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  ];
  return query(collection(db, MEDIA_COLLECTION), ...constraints);
}

async function pageFrom(
  notAfter: Date,
  cursor: MediaCursor | null,
  pageSize: number
): Promise<MediaPage> {
  const snapshot = await getDocs(publishedQuery(notAfter, cursor, pageSize));
  const posts = snapshot.docs
    .map((d) => toMediaPost(d.id, d.data()))
    .filter((post): post is MediaPost => post !== null);
  const last = snapshot.docs[snapshot.docs.length - 1];
  return {
    posts,
    // A short page means there is no more to ask for. Handing back a
    // cursor anyway would cost one empty read per scroll to the bottom,
    // forever.
    cursor: snapshot.docs.length < pageSize ? null : (last ?? null),
  };
}

/**
 * One page of published media, newest first.
 *
 * Paginated rather than subscribed: a church feed does not need to
 * update under the member's thumb, and a real-time listener over a
 * growing collection is a read every time anything in it changes. Pass
 * the previous page's `cursor` to get the next one.
 */
export async function fetchMediaPage(
  options: {
    cursor?: MediaCursor | null;
    pageSize?: number;
    now?: Date;
  } = {}
): Promise<MediaPage> {
  const { cursor = null, pageSize = MEDIA_PAGE_SIZE, now = new Date() } = options;
  try {
    return await pageFrom(now, cursor, pageSize);
  } catch (error) {
    const code = (error as FirestoreError | undefined)?.code;
    if (code === 'failed-precondition') {
      console.warn(
        `[media] the feed query was rejected, which usually means the composite ` +
          `index for '${MEDIA_COLLECTION}' (published ASC, publishAt DESC) has not ` +
          `been deployed. See /firestore.indexes.json.`,
        error
      );
    }
    // Only a denial is worth retrying with an earlier bound -- a device
    // whose clock runs fast asked for something the rules will not allow
    // yet. Same reasoning as ./prophetVerses.ts.
    if (code !== 'permission-denied') throw error;
    return pageFrom(new Date(now.getTime() - CLOCK_SKEW_ALLOWANCE_MS), cursor, pageSize);
  }
}

/** One post, for the detail screen and for a link that skipped the feed. */
export async function fetchMediaPost(mediaId: string): Promise<MediaPost | null> {
  const snapshot = await getDoc(doc(db, MEDIA_COLLECTION, mediaId));
  if (!snapshot.exists()) return null;
  return toMediaPost(snapshot.id, snapshot.data());
}

// --- A member's own interactions -------------------------------------

/** The small copy of a post a save carries. See this file's header. */
export interface SavedMedia {
  id: string;
  type: MediaType;
  mediaUrl: string;
  caption: string;
  savedAt: Date | null;
}

function likeRef(uid: string, mediaId: string) {
  return doc(db, 'users', uid, MEDIA_LIKES_SUBCOLLECTION, mediaId);
}

function saveRef(uid: string, mediaId: string) {
  return doc(db, 'users', uid, MEDIA_SAVES_SUBCOLLECTION, mediaId);
}

/**
 * Every post this member has liked, as a set of media ids.
 *
 * ONE read for the whole feed rather than one per card. A member's likes
 * are their own small collection, so reading all of it is cheaper than
 * checking ten posts individually, and it makes the feed's like state
 * available before the first card renders.
 */
export async function fetchLikedMediaIds(uid: string): Promise<Set<string>> {
  const snapshot = await getDocs(collection(db, 'users', uid, MEDIA_LIKES_SUBCOLLECTION));
  return new Set(snapshot.docs.map((d) => d.id));
}

export async function fetchSavedMediaIds(uid: string): Promise<Set<string>> {
  const snapshot = await getDocs(collection(db, 'users', uid, MEDIA_SAVES_SUBCOLLECTION));
  return new Set(snapshot.docs.map((d) => d.id));
}

export async function likeMedia(uid: string, mediaId: string): Promise<void> {
  await setDoc(likeRef(uid, mediaId), { createdAt: serverTimestamp() });
}

export async function unlikeMedia(uid: string, mediaId: string): Promise<void> {
  await deleteDoc(likeRef(uid, mediaId));
}

export async function saveMedia(uid: string, post: MediaPost): Promise<void> {
  await setDoc(saveRef(uid, post.id), {
    type: post.type,
    mediaUrl: post.mediaUrl,
    caption: post.caption,
    createdAt: serverTimestamp(),
  });
}

export async function unsaveMedia(uid: string, mediaId: string): Promise<void> {
  await deleteDoc(saveRef(uid, mediaId));
}

/** The member's saved posts, newest save first. */
export async function fetchSavedMedia(uid: string): Promise<SavedMedia[]> {
  const snapshot = await getDocs(
    query(
      collection(db, 'users', uid, MEDIA_SAVES_SUBCOLLECTION),
      orderBy('createdAt', 'desc')
    )
  );
  return snapshot.docs.map((d) => {
    const data = d.data();
    const type = data.type === 'video' ? 'video' : 'image';
    return {
      id: d.id,
      type,
      mediaUrl: typeof data.mediaUrl === 'string' ? data.mediaUrl : '',
      caption: typeof data.caption === 'string' ? data.caption : '',
      savedAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    };
  });
}

// --- Comments ---------------------------------------------------------

export interface MediaComment {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  createdAt: Date | null;
}

function toMediaComment(id: string, data: Record<string, unknown>): MediaComment {
  return {
    id,
    text: typeof data.text === 'string' ? data.text : '',
    authorUid: typeof data.authorUid === 'string' ? data.authorUid : '',
    authorName:
      typeof data.authorName === 'string' && data.authorName.trim().length > 0
        ? data.authorName.trim()
        : '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  };
}

/**
 * Comments on a post, oldest first, one page at a time.
 *
 * Oldest first because a comment thread reads as a conversation, and a
 * page at a time because a post that attracts a hundred comments should
 * not cost a hundred reads to open.
 */
export async function fetchComments(
  mediaId: string,
  pageSize: number = COMMENTS_PAGE_SIZE
): Promise<MediaComment[]> {
  const snapshot = await getDocs(
    query(
      collection(db, MEDIA_COLLECTION, mediaId, MEDIA_COMMENTS_SUBCOLLECTION),
      orderBy('createdAt', 'asc'),
      limit(pageSize)
    )
  );
  return snapshot.docs.map((d) => toMediaComment(d.id, d.data()));
}

/**
 * Subscribes to a post's comments while its detail screen is open.
 *
 * The ONE real-time listener in this feature, and only while a member is
 * looking at a single post: a comment appearing as it is written is the
 * point of a comment thread, and the cost is bounded by the page size
 * and by the screen being closed.
 */
export function subscribeToComments(
  mediaId: string,
  onNext: (comments: MediaComment[]) => void,
  onError: (error: FirestoreError) => void,
  pageSize: number = COMMENTS_PAGE_SIZE
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, MEDIA_COLLECTION, mediaId, MEDIA_COMMENTS_SUBCOLLECTION),
      orderBy('createdAt', 'asc'),
      limit(pageSize)
    ),
    (snapshot) => onNext(snapshot.docs.map((d) => toMediaComment(d.id, d.data()))),
    onError
  );
}

export async function addComment(options: {
  mediaId: string;
  uid: string;
  authorName: string;
  text: string;
}): Promise<void> {
  const { mediaId, uid, authorName, text } = options;
  await addDoc(collection(db, MEDIA_COLLECTION, mediaId, MEDIA_COMMENTS_SUBCOLLECTION), {
    text: text.trim(),
    authorUid: uid,
    authorName,
    createdAt: serverTimestamp(),
  });
}

export async function deleteComment(mediaId: string, commentId: string): Promise<void> {
  await deleteDoc(
    doc(db, MEDIA_COLLECTION, mediaId, MEDIA_COMMENTS_SUBCOLLECTION, commentId)
  );
}
