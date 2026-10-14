/**
 * Firestore data layer for the media LIBRARY: a record of every file an
 * administrator has uploaded or linked, so it can be found and reused.
 *
 * =====================================================================
 * A LIBRARY OF RECORDS, NOT A COPY OF THE FILES
 * =====================================================================
 * The files themselves live on Cloudinary (or YouTube, or wherever a
 * pasted link points). This collection holds only what the admin screens
 * need to list and find them: a title, a category, the public https
 * address, and the technical details Cloudinary reported (size, format,
 * dimensions, duration). It is NOT the source of truth for any piece of
 * content -- an announcement stores its own image address, a song its own
 * audio address -- and no content document refers to a library record by
 * id. So:
 *
 *   * DELETING A RECORD NEVER DELETES THE FILE, and cannot break anything
 *     that uses it. An unsigned upload has no right to delete, and a file
 *     in use must not vanish because someone tidied a list. The delete
 *     confirmation says so.
 *   * THIS PROJECT NEVER TALKS TO CLOUDINARY'S ADMIN API. That API needs
 *     the API secret, which must never be in browser code. The library is
 *     therefore a Firestore collection the admin writes to when an
 *     upload succeeds, not a view onto the Cloudinary account. A file
 *     uploaded from the Cloudinary console directly will not appear
 *     here until it is added as a link.
 *
 * The collection is `media_assets`. (`media` is the congregation's feed of
 * photos and videos -- a different thing, with its own screens.)
 *
 * Every write is followed by logAdminAction, as for every other
 * collection.
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
import {
  MEDIA_CATEGORIES,
  MEDIA_KINDS,
  MEDIA_SOURCES,
  type MediaCategory,
  type MediaKind,
  type MediaSource,
  type UploadedAsset,
} from '../media/types';
import { youTubeThumbnailUrl, type ParsedYouTube } from '../media/youtube';

const COLLECTION = 'media_assets';

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  source: MediaSource;
  category: MediaCategory;
  title: string;
  /** What a picture shows, for people who cannot see it. Empty for audio. */
  altText: string;
  /** The public https address. What content documents store. */
  url: string;
  thumbnailUrl: string | null;
  publicId: string | null;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  originalFilename: string | null;
  youtubeId: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** What the screens fill in; the rest is derived from the file or link. */
export interface MediaAssetDetails {
  title: string;
  altText: string;
  category: MediaCategory;
}

export interface MediaAuthor {
  uid: string;
  name: string;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function toMediaAsset(id: string, data: Record<string, unknown>): MediaAsset {
  return {
    id,
    kind: oneOf(data.kind, MEDIA_KINDS, 'image'),
    source: oneOf(data.source, MEDIA_SOURCES, 'link'),
    category: oneOf(data.category, MEDIA_CATEGORIES, 'general'),
    title: str(data.title),
    altText: str(data.altText),
    url: str(data.url),
    thumbnailUrl: strOrNull(data.thumbnailUrl),
    publicId: strOrNull(data.publicId),
    format: strOrNull(data.format),
    bytes: numOrNull(data.bytes),
    width: numOrNull(data.width),
    height: numOrNull(data.height),
    durationSeconds: numOrNull(data.durationSeconds),
    originalFilename: strOrNull(data.originalFilename),
    youtubeId: strOrNull(data.youtubeId),
    createdBy: str(data.createdBy),
    createdByName: str(data.createdByName),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/** Every record, newest first. */
export function subscribeToMediaAssets(
  onNext: (assets: MediaAsset[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toMediaAsset(d.id, d.data()))),
    onError
  );
}

/** The fields a record is written with, before the timestamps. */
export interface MediaAssetWrite {
  kind: MediaKind;
  source: MediaSource;
  category: MediaCategory;
  title: string;
  altText: string;
  url: string;
  thumbnailUrl: string | null;
  publicId: string | null;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  originalFilename: string | null;
  youtubeId: string | null;
}

/** A fallback title from a file name: "Sunday-Poster_final.png" -> "Sunday Poster final". */
export function titleFromFilename(name: string | null): string {
  if (!name) return 'Untitled';
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return base.length > 0 ? base.slice(0, 200) : 'Untitled';
}

export function assetFromUpload(
  uploaded: UploadedAsset,
  details: MediaAssetDetails
): MediaAssetWrite {
  return {
    kind: uploaded.kind,
    source: 'cloudinary',
    category: details.category,
    title: details.title.trim() || titleFromFilename(uploaded.originalFilename),
    altText: uploaded.kind === 'image' ? details.altText.trim() : '',
    url: uploaded.url,
    // Thumbnails of Cloudinary images are derived when shown (see
    // ../media/delivery.ts); nothing is stored that could go stale.
    thumbnailUrl: null,
    publicId: uploaded.publicId,
    format: uploaded.format,
    bytes: uploaded.bytes,
    width: uploaded.width,
    height: uploaded.height,
    durationSeconds: uploaded.durationSeconds,
    originalFilename: uploaded.originalFilename,
    youtubeId: null,
  };
}

export function assetFromYouTube(
  parsed: ParsedYouTube,
  details: MediaAssetDetails
): MediaAssetWrite {
  return {
    kind: 'video',
    source: 'youtube',
    category: details.category,
    title: details.title.trim() || 'YouTube video',
    altText: '',
    url: parsed.canonicalUrl,
    thumbnailUrl: youTubeThumbnailUrl(parsed.videoId),
    publicId: null,
    format: null,
    bytes: null,
    width: null,
    height: null,
    durationSeconds: null,
    originalFilename: null,
    youtubeId: parsed.videoId,
  };
}

export function assetFromLink(
  url: string,
  kind: MediaKind,
  details: MediaAssetDetails
): MediaAssetWrite {
  return {
    kind,
    source: 'link',
    category: details.category,
    title: details.title.trim() || 'Linked file',
    altText: kind === 'image' ? details.altText.trim() : '',
    url: url.trim(),
    thumbnailUrl: null,
    publicId: null,
    format: null,
    bytes: null,
    width: null,
    height: null,
    durationSeconds: null,
    originalFilename: null,
    youtubeId: null,
  };
}

export async function createMediaAsset(
  input: MediaAssetWrite,
  author: MediaAuthor
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...input,
    createdBy: author.uid,
    createdByName: author.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'create',
    collection: 'media_assets',
    documentId: docRef.id,
    changeSummary: `Added ${input.kind} "${input.title}" to the media library`,
  });
  return docRef.id;
}

/** Only the label, description and category are editable; the file is not. */
export async function updateMediaAsset(
  id: string,
  details: MediaAssetDetails
): Promise<void> {
  const title = details.title.trim();
  await updateDoc(doc(db, COLLECTION, id), {
    title,
    altText: details.altText.trim(),
    category: details.category,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'media_assets',
    documentId: id,
    changeSummary: `Updated media library item "${title}"`,
  });
}

/**
 * Removes the RECORD only. The file stays where it is, and every address
 * already copied into an announcement, song or plan keeps working.
 * `title` is passed in because it is gone once the document is.
 */
export async function deleteMediaAsset(id: string, title: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
  await logAdminAction({
    action: 'delete',
    collection: 'media_assets',
    documentId: id,
    changeSummary: `Removed "${title}" from the media library (the file itself was not deleted)`,
  });
}
