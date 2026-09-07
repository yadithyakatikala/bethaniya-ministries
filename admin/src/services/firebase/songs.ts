/**
 * Firestore + Storage data layer for admin song management (Day 6).
 * Mirrors ./announcements.ts's shape and reasoning exactly (see that
 * module's header comment for the full audit-log/authorization-boundary
 * rationale, which applies identically here) -- songs has the same
 * published/unpublished shape announcements does (see types/index.ts's
 * Song doc comment), unlike daily_verses.
 *
 * `audioUrl` is stored as-is (an external URL -- see types/index.ts).
 * `coverUrl` is a Storage download URL, uploaded via uploadSongCoverImage
 * below, same pattern as announcements'/daily-verses' image upload.
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
import type { Song, SongFormInput } from '../../types';

const SONGS_COLLECTION = 'songs';

function toSong(id: string, data: Record<string, unknown>): Song {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    artist: typeof data.artist === 'string' ? data.artist : '',
    category: typeof data.category === 'string' ? data.category : '',
    lyrics: typeof data.lyrics === 'string' ? data.lyrics : '',
    audioUrl: typeof data.audioUrl === 'string' ? data.audioUrl : '',
    coverUrl: typeof data.coverUrl === 'string' ? data.coverUrl : null,
    published: data.published === true,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/**
 * Subscribes to every song, alphabetical by title -- admins can read all
 * (firestore.rules' isContentAdminOrAbove() read branch), unlike members,
 * who only ever see published ones (see mobile/src/services/firebase/songs.ts).
 */
export function subscribeToSongs(
  onNext: (songs: Song[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, SONGS_COLLECTION), orderBy('title', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toSong(d.id, d.data()))),
    onError
  );
}

/** New songs always start unpublished -- publishing is a separate, explicit action (see setSongPublished), same contract as createAnnouncement(). */
export async function createSong(input: SongFormInput): Promise<string> {
  const title = input.title.trim();
  const docRef = await addDoc(collection(db, SONGS_COLLECTION), {
    title,
    artist: input.artist.trim(),
    category: input.category.trim(),
    lyrics: input.lyrics.trim(),
    audioUrl: input.audioUrl.trim(),
    coverUrl: input.coverUrl,
    published: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'create',
    collection: 'songs',
    documentId: docRef.id,
    changeSummary: `Created song "${title}"`,
  });
  return docRef.id;
}

export async function updateSong(id: string, input: SongFormInput): Promise<void> {
  const title = input.title.trim();
  await updateDoc(doc(db, SONGS_COLLECTION, id), {
    title,
    artist: input.artist.trim(),
    category: input.category.trim(),
    lyrics: input.lyrics.trim(),
    audioUrl: input.audioUrl.trim(),
    coverUrl: input.coverUrl,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'songs',
    documentId: id,
    changeSummary: `Updated song "${title}"`,
  });
}

/** `title` is passed in (rather than re-read) because it's no longer available once the doc is deleted. */
export async function deleteSong(id: string, title: string): Promise<void> {
  await deleteDoc(doc(db, SONGS_COLLECTION, id));
  await logAdminAction({
    action: 'delete',
    collection: 'songs',
    documentId: id,
    changeSummary: `Deleted song "${title}"`,
  });
}

export async function setSongPublished(
  id: string,
  title: string,
  published: boolean
): Promise<void> {
  await updateDoc(doc(db, SONGS_COLLECTION, id), {
    published,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: published ? 'publish' : 'unpublish',
    collection: 'songs',
    documentId: id,
    changeSummary: `${published ? 'Published' : 'Unpublished'} song "${title}"`,
  });
}

/**
 * Uploads a song cover image to Storage and returns its download URL.
 *
 * Works fully against the local Storage emulator today, at ₹0 -- same
 * documented Blaze-gated production limitation as
 * ./announcements.ts's uploadAnnouncementImage(): creating/deploying the
 * default Storage bucket requires the Blaze plan, which this project
 * deliberately does not attach. Nothing here needs to change once Blaze is
 * attached -- only the emulator toggle does. Song *audio* has no
 * equivalent upload function -- see types/index.ts's Song doc comment.
 */
export async function uploadSongCoverImage(file: File): Promise<string> {
  const path = `content/songs/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
