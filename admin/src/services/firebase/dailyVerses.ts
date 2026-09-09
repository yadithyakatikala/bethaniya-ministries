/**
 * Firestore + Storage data layer for admin daily-verse management (Day 5).
 * Mirrors ./announcements.ts's shape and reasoning exactly (see that
 * module's header comment for the full audit-log/authorization-boundary
 * rationale, which applies identically here).
 *
 * Unlike announcements, there is no published/unpublished state -- see
 * types/index.ts's DailyVerse doc comment and firestore.rules' existing
 * daily_verses rule (`allow read: if isSignedIn()`, no publish check).
 * Do not add a publish/unpublish action for this collection.
 *
 * `date` is stored as a plain "YYYY-MM-DD" string (see types/index.ts),
 * ordered by that single field below -- Firestore auto-indexes
 * single-field ascending/descending order, so no firestore.indexes.json
 * entry is needed (a `daily_verses` composite-index entry existed there
 * from Day 1; a production Firestore deploy rejected it as unnecessary,
 * which is what caught the mistake -- see mobile's
 * services/firebase/dailyVerses.ts for the full explanation).
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './app';
import { logAdminAction } from './auditLog';
import type { DailyVerse, DailyVerseFormInput } from '../../types';

const DAILY_VERSES_COLLECTION = 'daily_verses';

function toDailyVerse(id: string, data: Record<string, unknown>): DailyVerse {
  return {
    id,
    reference: typeof data.reference === 'string' ? data.reference : '',
    text: typeof data.text === 'string' ? data.text : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
    date: typeof data.date === 'string' ? data.date : '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/**
 * Subscribes to every daily verse, newest date first -- admins can read
 * all (same as members/hosts, per the RBAC table's unconditional
 * daily_verses "Read" for every role; there is no admin-only read branch
 * to mirror from announcements here).
 */
export function subscribeToDailyVerses(
  onNext: (verses: DailyVerse[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, DAILY_VERSES_COLLECTION), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toDailyVerse(d.id, d.data()))),
    onError
  );
}

export async function createDailyVerse(input: DailyVerseFormInput): Promise<string> {
  const reference = input.reference.trim();
  const docRef = await addDoc(collection(db, DAILY_VERSES_COLLECTION), {
    reference,
    text: input.text.trim(),
    imageUrl: input.imageUrl,
    date: input.date,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'create',
    collection: 'daily_verses',
    documentId: docRef.id,
    changeSummary: `Created daily verse "${reference}" for ${input.date}`,
  });
  return docRef.id;
}

export async function updateDailyVerse(
  id: string,
  input: DailyVerseFormInput
): Promise<void> {
  const reference = input.reference.trim();
  await updateDoc(doc(db, DAILY_VERSES_COLLECTION, id), {
    reference,
    text: input.text.trim(),
    imageUrl: input.imageUrl,
    date: input.date,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'daily_verses',
    documentId: id,
    changeSummary: `Updated daily verse "${reference}" for ${input.date}`,
  });
}

/** `reference` is passed in (rather than re-read) because it's no longer available once the doc is deleted. */
export async function deleteDailyVerse(id: string, reference: string): Promise<void> {
  await deleteDoc(doc(db, DAILY_VERSES_COLLECTION, id));
  await logAdminAction({
    action: 'delete',
    collection: 'daily_verses',
    documentId: id,
    changeSummary: `Deleted daily verse "${reference}"`,
  });
}

/**
 * Uploads a daily-verse image to Storage and returns its download URL.
 *
 * Works fully against the local Storage emulator today, at ₹0 -- same
 * documented Blaze-gated production limitation as
 * ./announcements.ts's uploadAnnouncementImage(): creating/deploying the
 * default Storage bucket requires the Blaze plan, which this project
 * deliberately does not attach. Nothing here needs to change once Blaze is
 * attached -- only the emulator toggle does.
 */
export async function uploadDailyVerseImage(file: File): Promise<string> {
  const path = `content/daily_verses/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
