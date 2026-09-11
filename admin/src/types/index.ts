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
 * spec), not a moment in time, and sorts correctly under Firestore's
 * automatic single-field index for `date` (no firestore.indexes.json
 * entry needed -- see services/firebase/dailyVerses.ts) since zero-padded
 * ISO dates compare lexicographically the same as chronologically.
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

/**
 * An event (service, gathering, live stream, etc). `published` controls member visibility
 * (see firestore.rules' events read rule). `isLive`/`youtubeUrl` are managed separately by the
 * Live Stream Manager -- Hosts may update only those two fields (see firestore.rules), never the
 * rest of the document.
 */
export interface Event {
  id: string;
  title: string;
  location: string;
  description: string;
  startsAt: Date | null;
  published: boolean;
  isLive: boolean;
  /** YouTube URL for the live stream/recording, or '' if none is set yet. Not arbitrary media -- see mobile's youtube.ts parser. */
  youtubeUrl: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Fields the admin event form collects -- id/published/isLive/youtubeUrl/createdAt/updatedAt are set elsewhere (see services/firebase/events.ts). */
export interface EventFormInput {
  title: string;
  location: string;
  description: string;
  /** ISO-ish string from a <input type="datetime-local"> field; parsed to a Date on submit. */
  startsAt: string;
}

/**
 * A sent-notification record at /notifications_log/{id}, per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 10 plan ("Notification log
 * (view past sent)") and its RBAC table's `notifications_log` row
 * (Member: None, Host/Content Admin/Super Admin: Read). Written only by
 * the sendNotification Cloud Function via the Admin SDK (see
 * firestore.rules' notifications_log rule, `allow write: if false`) --
 * this admin app only ever reads this collection, never writes to it
 * directly.
 *
 * `recipientCount` is the real count of matching /users documents at the
 * moment of sending, computed server-side -- see
 * functions/src/sendNotification.ts's header comment for why this project
 * does not (and, without registered FCM tokens, cannot) claim any of this
 * was actually delivered as a push notification.
 */
export type NotificationRecipientGroup = 'all_members' | 'admins_only';

export interface NotificationLogEntry {
  id: string;
  title: string;
  message: string;
  /** Storage download URL, or null if no image was attached. */
  imageUrl: string | null;
  recipientGroup: NotificationRecipientGroup;
  recipientCount: number;
  sentBy: string;
  sentByEmail: string | null;
  sentAt: Date | null;
}

/** Fields the Notifications page composer collects and sends to the sendNotification callable -- see services/firebase/notifications.ts. */
export interface SendNotificationFormInput {
  title: string;
  message: string;
  imageUrl: string | null;
  recipientGroup: NotificationRecipientGroup;
}

/**
 * A row on the admin Users page at /users/{uid}, per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 11 plan ("table showing all
 * users, name, email, phone, role, join date"). Sourced from exactly the
 * fields functions/src/createUserProfile.ts's own header comment says the
 * Admin Users page needs -- nothing more.
 */
export interface AdminUserSummary {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  role: UserRole;
  createdAt: Date | null;
}

/** Every role a Super Admin may assign via the Users page -- mirrors
 * functions/src/updateUserRole.ts's ASSIGNABLE_ROLES exactly. */
export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  'super_admin',
  'content_admin',
  'host',
  'member',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  content_admin: 'Content Admin',
  host: 'Host',
  member: 'Member',
};

/**
 * The church-wide settings document at /settings/church, per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 13 plan and P0 feature #17
 * ("Settings -- Church name, logo URL, description, Support email, Save
 * button (syncs to mobile app display)"). firestore.rules' pre-existing
 * settings/{settingId} rule (Day 3) already matches the RBAC table's
 * `settings` row exactly (Member/Host/Content Admin: Read, Super Admin:
 * Read + write) -- see services/firebase/settings.ts's doc comment for
 * why no rules change is made for this feature.
 */
export interface ChurchSettings {
  churchName: string;
  logoUrl: string;
  description: string;
  supportEmail: string;
  updatedAt: Date | null;
}

/** Fields the admin Settings form actually collects -- updatedAt is set
 * server-side (see services/firebase/settings.ts's saveChurchSettings). */
export interface ChurchSettingsFormInput {
  churchName: string;
  logoUrl: string;
  description: string;
  supportEmail: string;
}

/**
 * A community post document at /community/{id} -- a new V1 feature added
 * per explicit owner decision (Plans/Prayers/Community are genuine new V1
 * features, not part of FINAL_ARCHITECTURE_SPECIFICATION.md's original
 * scope -- see PRODUCTION_READINESS.md's "New V1 features" section).
 * Same shape as Announcement (admin-authored, published-gated member
 * read) -- deliberately NOT an open member-posting social feed.
 */
export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  /** Storage download URL, or null until an image is uploaded/if none is set. */
  imageUrl: string | null;
  /** Controls visibility to members -- see firestore.rules' community read rule. */
  published: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Fields the admin form actually collects -- id/createdAt/updatedAt/published are set elsewhere (see services/firebase/communityPosts.ts). */
export interface CommunityPostFormInput {
  title: string;
  content: string;
  imageUrl: string | null;
}

/**
 * A Bible reading plan document at /plans/{id} -- a new V1 feature (see
 * CommunityPost's doc comment above for provenance). `dayCount` is
 * derived server-side from the real /plans/{id}/days subcollection (see
 * services/firebase/plans.ts) rather than accepted as free-typed admin
 * input, so it can never drift from the actual number of days created.
 * `order` controls display order in the mobile library (ascending,
 * lower first) -- there's no drag-and-drop reordering UI in V1, admins
 * set it as a plain number field.
 */
export interface Plan {
  id: string;
  title: string;
  description: string;
  category: string;
  /** Storage download URL, or null until a cover is uploaded/if none is set. */
  coverImageUrl: string | null;
  dayCount: number;
  order: number;
  /** Controls visibility to members -- see firestore.rules' plans read rule. */
  published: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Fields the admin plan form actually collects -- id/dayCount/createdAt/updatedAt/published are set elsewhere (see services/firebase/plans.ts). */
export interface PlanFormInput {
  title: string;
  description: string;
  category: string;
  coverImageUrl: string | null;
  order: number;
}

/**
 * A single day within a reading plan, at /plans/{planId}/days/{id}. A
 * subcollection (rather than an array field on the plan document) so an
 * admin can add/edit/delete one day without rewriting the entire plan
 * document -- see firestore.rules' isValidPlanDay() for the
 * server-enforced shape.
 */
export interface PlanDay {
  id: string;
  dayNumber: number;
  title: string;
  scriptureReference: string;
  devotional: string;
  /** Optional prompt shown alongside the day's reading -- '' if none set. */
  prayerPrompt: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/** Fields the admin plan-day form actually collects -- id/createdAt/updatedAt are set elsewhere (see services/firebase/plans.ts). */
export interface PlanDayFormInput {
  dayNumber: number;
  title: string;
  scriptureReference: string;
  devotional: string;
  prayerPrompt: string;
}
