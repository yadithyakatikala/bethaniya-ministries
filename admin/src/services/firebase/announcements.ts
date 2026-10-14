/**
 * Firestore data layer for admin announcement management (Day 4).
 *
 * Every write here is followed by a logAdminAction call (Day 3's audit-log
 * callable, wired in via ./auditLog -- see that module's doc for why a
 * failed audit-log call never blocks the content write). The actual
 * authorization boundary is firestore.rules' role checks, not anything in
 * this file -- see SECURITY.md's "Day 4" section.
 *
 * `imageUrl` is an https address. The form's <ImageField> obtains it (by
 * uploading to Cloudinary, picking from the media library, or pasting a
 * link) before Save; this module only stores it. There is no upload
 * function here: Firebase Storage needs the Blaze plan, which this
 * project does not attach.
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
import { db } from './app';
import { logAdminAction } from './auditLog';
import type { Announcement, AnnouncementFormInput } from '../../types';

const ANNOUNCEMENTS_COLLECTION = 'announcements';

function toAnnouncement(id: string, data: Record<string, unknown>): Announcement {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    content: typeof data.content === 'string' ? data.content : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
    published: data.published === true,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/**
 * Subscribes to every announcement, newest first -- admins can read all
 * (firestore.rules' isContentAdminOrAbove() read branch), unlike members,
 * who only ever see published ones (see mobile/src/services/firebase/announcements.ts).
 */
export function subscribeToAnnouncements(
  onNext: (announcements: Announcement[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, ANNOUNCEMENTS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toAnnouncement(d.id, d.data()))),
    onError
  );
}

/** New announcements always start unpublished -- publishing is a separate, explicit action (see setAnnouncementPublished). */
export async function createAnnouncement(input: AnnouncementFormInput): Promise<string> {
  const title = input.title.trim();
  const docRef = await addDoc(collection(db, ANNOUNCEMENTS_COLLECTION), {
    title,
    content: input.content.trim(),
    imageUrl: input.imageUrl,
    published: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'create',
    collection: 'announcements',
    documentId: docRef.id,
    changeSummary: `Created announcement "${title}"`,
  });
  return docRef.id;
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementFormInput
): Promise<void> {
  const title = input.title.trim();
  await updateDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id), {
    title,
    content: input.content.trim(),
    imageUrl: input.imageUrl,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'announcements',
    documentId: id,
    changeSummary: `Updated announcement "${title}"`,
  });
}

/** `title` is passed in (rather than re-read) because it's no longer available once the doc is deleted. */
export async function deleteAnnouncement(id: string, title: string): Promise<void> {
  await deleteDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id));
  await logAdminAction({
    action: 'delete',
    collection: 'announcements',
    documentId: id,
    changeSummary: `Deleted announcement "${title}"`,
  });
}

export async function setAnnouncementPublished(
  id: string,
  title: string,
  published: boolean
): Promise<void> {
  await updateDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id), {
    published,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: published ? 'publish' : 'unpublish',
    collection: 'announcements',
    documentId: id,
    changeSummary: `${published ? 'Published' : 'Unpublished'} announcement "${title}"`,
  });
}
