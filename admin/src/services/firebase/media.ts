/**
 * Firestore data layer for the media feed -- M6.
 *
 * ---------------------------------------------------------------------
 * NOTHING IS UPLOADED. THERE IS NO UPLOAD FUNCTION HERE.
 * ---------------------------------------------------------------------
 * There is no `uploadMedia()` in this file and there must not be.
 * Firebase Cloud Storage requires the Blaze plan, which this project
 * deliberately does not attach, so an administrator hosts the image or
 * video wherever they already do and pastes the link. The app stores the
 * link and the metadata around it. Same decision, and the same reason,
 * as ./songs.ts's audio and ./prophetVerses.ts's image.
 *
 * That makes the LINK the entire attack surface, which is why
 * ../../features/media/validation.ts exists and why firestore.rules
 * enforces the same https-only rule again server-side.
 *
 * ---------------------------------------------------------------------
 * publishAt IS A TIMESTAMP, AND SCHEDULING NEEDS NO CRON
 * ---------------------------------------------------------------------
 * A post becomes visible when `published` is true AND `publishAt` has
 * passed, compared against the SERVER's clock at read time. So a post
 * scheduled for Sunday morning simply starts being readable on Sunday
 * morning, with no Cloud Function and no scheduled job -- see
 * ./prophetVerses.ts, which works the same way, and
 * mobile/src/services/firebase/media.ts for the reading side.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './app';
import { logAdminAction } from './auditLog';

const MEDIA_COLLECTION = 'media';

export type MediaType = 'image' | 'video';

export interface MediaRecord {
  id: string;
  type: MediaType;
  /** External https url. Never a Storage path -- see this file's header. */
  mediaUrl: string;
  caption: string;
  verseReference: string | null;
  verseText: string | null;
  published: boolean;
  publishAt: Date | null;
  authorName: string;
  authorUid: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface MediaFormInput {
  type: MediaType;
  mediaUrl: string;
  caption: string;
  verseReference: string | null;
  verseText: string | null;
  published: boolean;
  publishAt: Date;
  authorName: string;
  authorUid: string;
}

export function toMediaRecord(id: string, data: Record<string, unknown>): MediaRecord {
  return {
    id,
    type: data.type === 'video' ? 'video' : 'image',
    mediaUrl: typeof data.mediaUrl === 'string' ? data.mediaUrl : '',
    caption: typeof data.caption === 'string' ? data.caption : '',
    verseReference: typeof data.verseReference === 'string' ? data.verseReference : null,
    verseText: typeof data.verseText === 'string' ? data.verseText : null,
    published: data.published === true,
    publishAt: data.publishAt instanceof Timestamp ? data.publishAt.toDate() : null,
    authorName: typeof data.authorName === 'string' ? data.authorName : '',
    authorUid: typeof data.authorUid === 'string' ? data.authorUid : '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/**
 * Every post, newest scheduled first -- drafts and future schedules
 * included, because managing those is what this page is for. A
 * single-field sort, so Firestore's automatic index covers it; the app's
 * own two-field query is the one that needs the composite index in
 * /firestore.indexes.json.
 */
export function subscribeToMedia(
  onNext: (posts: MediaRecord[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, MEDIA_COLLECTION), orderBy('publishAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toMediaRecord(d.id, d.data()))),
    onError
  );
}

export async function fetchMediaPost(id: string): Promise<MediaRecord | null> {
  const snapshot = await getDoc(doc(db, MEDIA_COLLECTION, id));
  return snapshot.exists() ? toMediaRecord(snapshot.id, snapshot.data()) : null;
}

function writablePayload(input: MediaFormInput) {
  return {
    type: input.type,
    mediaUrl: input.mediaUrl.trim(),
    caption: input.caption.trim(),
    // Written as null rather than omitted, so a field that was never set
    // and one an administrator cleared look the same to every reader.
    verseReference: input.verseReference?.trim() ? input.verseReference.trim() : null,
    verseText: input.verseText?.trim() ? input.verseText.trim() : null,
    published: input.published,
    publishAt: Timestamp.fromDate(input.publishAt),
    authorName: input.authorName.trim(),
    authorUid: input.authorUid,
  };
}

/** A caption is the closest thing a post has to a title, for the log. */
function labelFor(payload: { caption: string }): string {
  const caption = payload.caption.trim();
  if (caption.length === 0) return 'untitled post';
  return caption.length > 60 ? `${caption.slice(0, 57)}...` : caption;
}

export async function createMediaPost(input: MediaFormInput): Promise<string> {
  const payload = writablePayload(input);
  const docRef = await addDoc(collection(db, MEDIA_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'create',
    collection: 'media',
    documentId: docRef.id,
    changeSummary: `Created media post "${labelFor(payload)}"`,
  });
  return docRef.id;
}

export async function updateMediaPost(id: string, input: MediaFormInput): Promise<void> {
  const payload = writablePayload(input);
  await updateDoc(doc(db, MEDIA_COLLECTION, id), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'media',
    documentId: id,
    changeSummary: `Updated media post "${labelFor(payload)}"`,
  });
}

/**
 * Publishing is its own action and its own audit entry -- "who made this
 * visible to the congregation, and when" is a different question from
 * "who changed the wording".
 */
export async function setMediaPublished(
  id: string,
  caption: string,
  published: boolean
): Promise<void> {
  await updateDoc(doc(db, MEDIA_COLLECTION, id), {
    published,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: published ? 'publish' : 'unpublish',
    collection: 'media',
    documentId: id,
    changeSummary: `${published ? 'Published' : 'Unpublished'} media post "${labelFor({ caption })}"`,
  });
}

/** `caption` is passed in because it is gone once the document is. */
export async function deleteMediaPost(id: string, caption: string): Promise<void> {
  await deleteDoc(doc(db, MEDIA_COLLECTION, id));
  await logAdminAction({
    action: 'delete',
    collection: 'media',
    documentId: id,
    changeSummary: `Deleted media post "${labelFor({ caption })}"`,
  });
}
