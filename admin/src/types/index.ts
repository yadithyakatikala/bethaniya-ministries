/**
 * Shared TypeScript types for the admin dashboard.
 * Populated incrementally as features are built (auth, content models, etc).
 */

export type UserRole = 'super_admin' | 'content_admin' | 'host' | 'member';

/** Roles that may access the admin dashboard at all -- everything except plain members. */
export const ADMIN_DASHBOARD_ROLES: readonly UserRole[] = [
  'host',
  'content_admin',
  'super_admin',
];

export function canAccessAdminDashboard(role: UserRole | null): boolean {
  return role !== null && ADMIN_DASHBOARD_ROLES.includes(role);
}

/**
 * An announcement document at /announcements/{id}, per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 4 plan and firestore.rules'
 * isValidAnnouncement() (which enforces title/content/published's shape
 * server-side -- see that rule's comment for why imageUrl and the
 * timestamps aren't rules-validated the same strict way).
 */
export interface Announcement {
  id: string;
  title: string;
  content: string;
  /** Storage download URL, or null until an image is uploaded/if none is set. */
  imageUrl: string | null;
  /** Controls visibility to members -- see firestore.rules' announcements read rule. */
  published: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Fields the admin form actually collects -- id/createdAt/updatedAt/published are set elsewhere (see services/firebase/announcements.ts). */
export interface AnnouncementFormInput {
  title: string;
  content: string;
  imageUrl: string | null;
}

/**
 * A daily verse document at /daily_verses/{id}, per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 5 plan. Unlike Announcement,
 * there is no `published` field -- the RBAC table's daily_verses row is
 * "Member: Read / Host: Read" (unconditional), not "Read published", and
 * firestore.rules' existing daily_verses rule already reflects that
 * (`allow read: if isSignedIn()`, no publish check). Do not add a
 * publish/unpublish mechanism here.
 *
 * `date` is a plain "YYYY-MM-DD" string, not a Firestore Timestamp -- this
 * models a calendar date ("applies to mobile app on that date", per the
 * spec), not a moment in time, and sorts correctly with
 * firestore.indexes.json's existing `daily_verses` (date DESCENDING) index
 * since zero-padded ISO dates compare lexicographically the same as
 * chronologically.
 */
export interface DailyVerse {
  id: string;
  /** Scripture reference, e.g. "John 3:16". */
  reference: string;
  /** Verse text -- admin-typed. No Bible API is used to auto-fill this: Bible
   * licensing/source is unresolved (see BIBLE_LICENSING.md), and the spec's
   * own Day 5 plan already treats "auto-fill if available, else placeholder"
   * as a fallback, not a requirement. */
  text: string;
  /** Storage download URL, or null until an image is uploaded/if none is set. */
  imageUrl: string | null;
  date: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Fields the admin form actually collects -- id/createdAt/updatedAt are set elsewhere (see services/firebase/dailyVerses.ts). */
export interface DailyVerseFormInput {
  reference: string;
  text: string;
  imageUrl: string | null;
  date: string;
}

/**
 * A song document at /songs/{id}, per FINAL_ARCHITECTURE_SPECIFICATION.md's
 * Day 6 plan. Unlike DailyVerse, songs DO have a `published` field -- the
 * RBAC table's songs row is "Member: Read published / Host: Read all",
 * the same shape as Announcement, and firestore.rules' existing songs
 * rule already reflects that.
 *
 * `audioUrl` is always an external URL -- per storage.rules' own comment
 * ("no audio files in Storage; song audio is referenced by external URL")
 * this project deliberately does not upload or store audio in Firebase
 * Storage. It must be a direct link to a playable audio file or stream
 * (e.g. .mp3/.m4a/.wav, or an HLS .m3u8 URL) -- expo-audio (the mobile
 * player, see mobile/src/features/songs/AudioPlayer.tsx) hands this URI
 * straight to the platform's native media player, which does not resolve
 * third-party webpages such as a YouTube watch page or a Spotify track
 * page into playable audio, so those are not valid values here even
 * though the spec's own sample-data note mentions them loosely.
 * `coverUrl` is the one Storage-backed field here, uploaded the same way
 * Announcement's/DailyVerse's imageUrl are (see
 * services/firebase/songs.ts's uploadSongCoverImage).
 */
export interface Song {
  id: string;
  title: string;
  artist: string;
  category: string;
  lyrics: string;
  audioUrl: string;
  /** Storage download URL, or null until a cover is uploaded/if none is set. */
  coverUrl: string | null;
  /** Controls visibility to members -- see firestore.rules' songs read rule. */
  published: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Fields the admin form actually collects -- id/createdAt/updatedAt/published are set elsewhere (see services/firebase/songs.ts). */
export interface SongFormInput {
  title: string;
  artist: string;
  category: string;
  lyrics: string;
  audioUrl: string;
  coverUrl: string | null;
}
