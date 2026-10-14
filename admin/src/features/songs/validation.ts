/**
 * Client-side song input validation, mirroring
 * ../announcements/validation.ts's and ../daily-verses/validation.ts's
 * shape and reasoning: this is a UX convenience only. Server-enforced
 * authority is firestore.rules' isValidSong() for the text fields. The
 * cover image and the song itself are uploaded to Cloudinary by
 * <ImageField> / <AudioField> (docs/admin/MEDIA_UPLOADS.md).
 *
 * `audioUrl` is checked for a plausible http(s) URL shape only -- this
 * project doesn't fetch or validate that the URL actually resolves to
 * playable audio client-side (that's the mobile AudioPlayer's job at
 * playback time, see mobile/src/features/songs/AudioPlayer.tsx, which
 * handles an invalid/unavailable URL without crashing).
 */

import { validateUploadFile } from '../../services/media/uploadRules';

export const SONG_TITLE_MAX_LENGTH = 200;
export const SONG_ARTIST_MAX_LENGTH = 200;
export const SONG_CATEGORY_MAX_LENGTH = 100;
export const SONG_LYRICS_MAX_LENGTH = 10000;
export const SONG_AUDIO_URL_MAX_LENGTH = 2000;

const HTTP_URL_PATTERN = /^https?:\/\/.+/i;

export interface SongValidationInput {
  title: string;
  artist: string;
  category: string;
  lyrics: string;
  audioUrl: string;
}

export interface SongValidationErrors {
  title?: string;
  artist?: string;
  category?: string;
  lyrics?: string;
  audioUrl?: string;
}

/** Validates title/artist/category/lyrics/audioUrl (trimmed). Returns an empty object when valid. */
export function validateSongInput(input: SongValidationInput): SongValidationErrors {
  const errors: SongValidationErrors = {};

  const title = input.title.trim();
  if (title.length === 0) {
    errors.title = 'Title is required.';
  } else if (title.length > SONG_TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${SONG_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  const artist = input.artist.trim();
  if (artist.length === 0) {
    errors.artist = 'Artist is required.';
  } else if (artist.length > SONG_ARTIST_MAX_LENGTH) {
    errors.artist = `Artist must be ${SONG_ARTIST_MAX_LENGTH} characters or fewer.`;
  }

  const category = input.category.trim();
  if (category.length === 0) {
    errors.category = 'Category is required.';
  } else if (category.length > SONG_CATEGORY_MAX_LENGTH) {
    errors.category = `Category must be ${SONG_CATEGORY_MAX_LENGTH} characters or fewer.`;
  }

  const lyrics = input.lyrics.trim();
  if (lyrics.length === 0) {
    errors.lyrics = 'Lyrics are required.';
  } else if (lyrics.length > SONG_LYRICS_MAX_LENGTH) {
    errors.lyrics = `Lyrics must be ${SONG_LYRICS_MAX_LENGTH} characters or fewer.`;
  }

  const audioUrl = input.audioUrl.trim();
  if (audioUrl.length === 0) {
    errors.audioUrl = 'Audio URL is required.';
  } else if (audioUrl.length > SONG_AUDIO_URL_MAX_LENGTH) {
    errors.audioUrl = `Audio URL must be ${SONG_AUDIO_URL_MAX_LENGTH} characters or fewer.`;
  } else if (!HTTP_URL_PATTERN.test(audioUrl)) {
    errors.audioUrl = 'Audio URL must be a valid http(s) URL.';
  }

  return errors;
}

export function hasValidationErrors(errors: SongValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Whether this file may be uploaded as a song cover. It is the shared image
 * rule (../../services/media/uploadRules.ts) -- the same formats and
 * 5 MB ceiling for every picture -- so a mistake is caught in the browser
 * before an upload starts. A courtesy only: the limits that really apply
 * are set on the Cloudinary upload preset (docs/admin/MEDIA_UPLOADS.md).
 */
export function validateSongCoverImage(file: File): string | null {
  return validateUploadFile(file, 'image');
}
