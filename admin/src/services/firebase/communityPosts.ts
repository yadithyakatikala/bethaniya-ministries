/**
 * Firestore + Storage data layer for admin community-post management -- a
 * new V1 feature added per explicit owner decision (see
 * ../../types/index.ts's CommunityPost doc comment for provenance).
 * Mirrors ./announcements.ts's shape and reasoning exactly (see that
 * module's header comment for the full audit-log/authorization-boundary
 * rationale, which applies identically here).
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
import type { CommunityPost, CommunityPostFormInput } from '../../types';

const COMMUNITY_COLLECTION = 'community';

function toCommunityPost(id: string, data: Record<string, unknown>): CommunityPost {
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

/** Subscribes to every community post, newest first -- admins can read all, unlike members (see mobile's communityPosts.ts). */
export function subscribeToCommunityPosts(
  onNext: (posts: CommunityPost[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, COMMUNITY_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toCommunityPost(d.id, d.data()))),
    onError
  );
}

/** New community posts always start unpublished -- publishing is a separate, explicit action (see setCommunityPostPublished). */
export async function createCommunityPost(input: CommunityPostFormInput): Promise<string> {
  const title = input.title.trim();
  const docRef = await addDoc(collection(db, COMMUNITY_COLLECTION), {
    title,
    content: input.content.trim(),
    imageUrl: input.imageUrl,
    published: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'create',
    collection: 'community',
    documentId: docRef.id,
    changeSummary: `Created community post "${title}"`,
  });
  return docRef.id;
}

export async function updateCommunityPost(
  id: string,
  input: CommunityPostFormInput
): Promise<void> {
  const title = input.title.trim();
  await updateDoc(doc(db, COMMUNITY_COLLECTION, id), {
    title,
    content: input.content.trim(),
    imageUrl: input.imageUrl,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'community',
    documentId: id,
    changeSummary: `Updated community post "${title}"`,
  });
}

/** `title` is passed in (rather than re-read) because it's no longer available once the doc is deleted. */
export async function deleteCommunityPost(id: string, title: string): Promise<void> {
  await deleteDoc(doc(db, COMMUNITY_COLLECTION, id));
  await logAdminAction({
    action: 'delete',
    collection: 'community',
    documentId: id,
    changeSummary: `Deleted community post "${title}"`,
  });
}

export async function setCommunityPostPublished(
  id: string,
  title: string,
  published: boolean
): Promise<void> {
  await updateDoc(doc(db, COMMUNITY_COLLECTION, id), {
    published,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: published ? 'publish' : 'unpublish',
    collection: 'community',
    documentId: id,
    changeSummary: `${published ? 'Published' : 'Unpublished'} community post "${title}"`,
  });
}

/**
 * Uploads a community-post image to Storage and returns its download URL.
 * Same emulator-only-until-Blaze limitation as
 * ./announcements.ts's uploadAnnouncementImage -- see that function's doc
 * comment.
 */
export async function uploadCommunityPostImage(file: File): Promise<string> {
  const path = `content/community/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
