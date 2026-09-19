/**
 * Firestore data layer for Prophet Verses -- a content system separate
 * from `daily_verses`, with its own collection, page and permissions.
 *
 * ---------------------------------------------------------------------
 * NO IMAGE UPLOADS
 * ---------------------------------------------------------------------
 * There is no `uploadProphetVerseImage()` here, and there must not be.
 * Firebase Cloud Storage requires the Blaze plan, which this project
 * deliberately does not attach, so the optional image is an EXTERNAL
 * https url -- the same decision ./songs.ts documents for song audio.
 * Nothing on a server fetches that url; the member's own device loads it,
 * exactly as it already does for an announcement image.
 *
 * ---------------------------------------------------------------------
 * publishAt IS A TIMESTAMP
 * ---------------------------------------------------------------------
 * Unlike `daily_verses.date`, which is a "YYYY-MM-DD" calendar key
 * matched exactly, `publishAt` is an INSTANT: "show this from 6am on
 * Sunday". The mobile app compares it with <= against the server clock,
 * and firestore.rules enforces the same comparison, so a member cannot
 * read a future-dated record by winding their phone forward. See
 * mobile/src/services/firebase/prophetVerses.ts for the ordering rule.
 *
 * Scheduling therefore needs no Cloud Function and no cron: a record
 * published with a future `publishAt` simply becomes visible when that
 * moment passes, because the comparison happens at read time.
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

const PROPHET_VERSES_COLLECTION = 'prophet_verses';

export interface ProphetVerseRecord {
  id: string;
  title: string;
  reference: string;
  text: string;
  attribution: string | null;
  /** External https url, or null. Never a Storage path. */
  imageUrl: string | null;
  published: boolean;
  publishAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ProphetVerseFormInput {
  title: string;
  reference: string;
  text: string;
  attribution: string | null;
  imageUrl: string | null;
  published: boolean;
  publishAt: Date;
}

export function toProphetVerseRecord(
  id: string,
  data: Record<string, unknown>
): ProphetVerseRecord {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    reference: typeof data.reference === 'string' ? data.reference : '',
    text: typeof data.text === 'string' ? data.text : '',
    attribution: typeof data.attribution === 'string' ? data.attribution : null,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
    published: data.published === true,
    publishAt: data.publishAt instanceof Timestamp ? data.publishAt.toDate() : null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/**
 * Every record, newest scheduled first -- drafts and future schedules
 * included, because managing those is what this page is for. A single-field
 * sort, so Firestore's automatic index covers it; the app's own query is
 * the one that needs the composite index in /firestore.indexes.json.
 */
export function subscribeToProphetVerses(
  onNext: (verses: ProphetVerseRecord[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, PROPHET_VERSES_COLLECTION),
    orderBy('publishAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toProphetVerseRecord(d.id, d.data()))),
    onError
  );
}

export async function fetchProphetVerse(id: string): Promise<ProphetVerseRecord | null> {
  const snapshot = await getDoc(doc(db, PROPHET_VERSES_COLLECTION, id));
  return snapshot.exists() ? toProphetVerseRecord(snapshot.id, snapshot.data()) : null;
}

function writablePayload(input: ProphetVerseFormInput) {
  return {
    title: input.title.trim(),
    reference: input.reference.trim(),
    text: input.text.trim(),
    // Written as null rather than omitted, so the field's absence and an
    // administrator clearing it are the same thing to every reader.
    attribution: input.attribution?.trim() ? input.attribution.trim() : null,
    imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
    published: input.published,
    publishAt: Timestamp.fromDate(input.publishAt),
  };
}

export async function createProphetVerse(input: ProphetVerseFormInput): Promise<string> {
  const payload = writablePayload(input);
  const docRef = await addDoc(collection(db, PROPHET_VERSES_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'create',
    collection: 'prophet_verses',
    documentId: docRef.id,
    changeSummary: `Created prophet verse "${payload.title}"`,
  });
  return docRef.id;
}

export async function updateProphetVerse(
  id: string,
  input: ProphetVerseFormInput
): Promise<void> {
  const payload = writablePayload(input);
  await updateDoc(doc(db, PROPHET_VERSES_COLLECTION, id), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'prophet_verses',
    documentId: id,
    changeSummary: `Updated prophet verse "${payload.title}"`,
  });
}

/**
 * Publishing and unpublishing is its own action, and its own audit-log
 * entry -- "who made this visible to the congregation, and when" is a
 * different question from "who edited the wording".
 */
export async function setProphetVersePublished(
  id: string,
  title: string,
  published: boolean
): Promise<void> {
  await updateDoc(doc(db, PROPHET_VERSES_COLLECTION, id), {
    published,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: published ? 'publish' : 'unpublish',
    collection: 'prophet_verses',
    documentId: id,
    changeSummary: `${published ? 'Published' : 'Unpublished'} prophet verse "${title}"`,
  });
}

/** `title` is passed in because it is gone once the document is. */
export async function deleteProphetVerse(id: string, title: string): Promise<void> {
  await deleteDoc(doc(db, PROPHET_VERSES_COLLECTION, id));
  await logAdminAction({
    action: 'delete',
    collection: 'prophet_verses',
    documentId: id,
    changeSummary: `Deleted prophet verse "${title}"`,
  });
}
