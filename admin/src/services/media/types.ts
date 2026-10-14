/**
 * The vocabulary of the media library, shared by the uploader, the
 * Firestore service, and the screens.
 *
 * `kind` is what the file IS (and so what can use it: a cover wants an
 * image, a song wants audio). `source` is where it lives: a file uploaded
 * to Cloudinary, a YouTube video, or any other https link an administrator
 * pasted. `category` is what an administrator filed it under, so a library
 * of two hundred pictures can be narrowed to "plan covers".
 */
import type { UploadKind } from './cloudinaryConfig';

export type MediaKind = 'image' | 'audio' | 'video';
export type MediaSource = 'cloudinary' | 'youtube' | 'link';

export const MEDIA_KINDS: readonly MediaKind[] = ['image', 'audio', 'video'];
export const MEDIA_SOURCES: readonly MediaSource[] = ['cloudinary', 'youtube', 'link'];

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
};

export const MEDIA_CATEGORIES = [
  'poster',
  'cover',
  'thumbnail',
  'song',
  'video',
  'general',
] as const;

export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const MEDIA_CATEGORY_LABELS: Record<MediaCategory, string> = {
  poster: 'Posters',
  cover: 'Covers',
  thumbnail: 'Thumbnails',
  song: 'Songs & worship',
  video: 'Videos',
  general: 'General',
};

/** What a successful upload to Cloudinary gives back, validated. */
export interface UploadedAsset {
  /** The https delivery address Cloudinary returned (`secure_url`). */
  url: string;
  /** Cloudinary's identifier for the file. Not a secret. */
  publicId: string;
  /** Cloudinary's own word: audio is stored as `video`. */
  resourceType: 'image' | 'video';
  kind: UploadKind;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  originalFilename: string | null;
}
