/**
 * Read/write access to the signed-in user's own /users/{uid} Firestore
 * document -- the mobile-side data layer for Day 9's Profile and Settings
 * screens.
 *
 * Read side mirrors ./dailyVerses.ts's subscribeToX(onNext, onError) shape
 * (onSnapshot + a defensive toX(id, data) mapper). Write side
 * (updateOwnProfile) is new territory for mobile: this is the first mobile
 * module that calls updateDoc against Firestore (every prior mobile
 * Firestore module -- announcements.ts, dailyVerses.ts, events.ts,
 * songs.ts -- is read-only; writes have so far only ever come from the
 * admin dashboard or Cloud Functions).
 *
 * Field allowlist: updateOwnProfile's UpdatableUserProfileFields type
 * intentionally only allows displayName/photoURL/languagePreference/
 * themePreference/notificationsEnabled -- the exact same allowlist
 * firestore.rules' users/{userId} update rule enforces server-side via
 * `.diff(resource.data).affectedKeys().hasOnly([...])`. This client-side
 * type is a UX convenience (it makes an attempt to set role/email/
 * phoneNumber/createdAt a compile-time error, not just a runtime
 * permission-denied) -- the actual security boundary is firestore.rules,
 * not this file, exactly like admin/src/services/firebase/userProfile.ts's
 * fetchOwnRole() documents for its own read-only case.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { db } from './app';

export type LanguagePreference = 'en' | 'te';
export type ThemePreference = 'light' | 'dark';

export interface UserProfile {
  uid: string;
  role: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  languagePreference: LanguagePreference | null;
  themePreference: ThemePreference | null;
  notificationsEnabled: boolean | null;
}

/** Exactly the fields an owner is ever allowed to write -- see this file's
 * header comment. Every field is optional: callers pass only the ones
 * they're actually changing, so a Settings toggle never has to first read
 * back and resend displayName just to flip notificationsEnabled. */
export interface UpdatableUserProfileFields {
  displayName?: string;
  photoURL?: string | null;
  languagePreference?: LanguagePreference;
  themePreference?: ThemePreference;
  notificationsEnabled?: boolean;
}

function toUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  const languagePreference =
    data.languagePreference === 'en' || data.languagePreference === 'te'
      ? data.languagePreference
      : null;
  const themePreference =
    data.themePreference === 'light' || data.themePreference === 'dark'
      ? data.themePreference
      : null;
  return {
    uid,
    role: typeof data.role === 'string' ? data.role : 'member',
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    email: typeof data.email === 'string' ? data.email : null,
    phoneNumber: typeof data.phoneNumber === 'string' ? data.phoneNumber : null,
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    languagePreference,
    themePreference,
    notificationsEnabled:
      typeof data.notificationsEnabled === 'boolean' ? data.notificationsEnabled : null,
  };
}

/**
 * `onNext` receives `null` if the document doesn't exist yet (shouldn't
 * normally happen post-sign-in, since createUserProfile's auth trigger
 * creates it -- but the trigger's write and the client's first read are
 * two independent, unordered events, so a brief window where the doc
 * isn't there yet is possible and must be handled, not crash).
 */
export function subscribeToOwnProfile(
  uid: string,
  onNext: (profile: UserProfile | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const ref = doc(db, 'users', uid);
  return onSnapshot(
    ref,
    (snapshot) => {
      onNext(snapshot.exists() ? toUserProfile(snapshot.id, snapshot.data()) : null);
    },
    onError
  );
}

/**
 * Writes only the fields present on `fields` -- never the full profile --
 * so this can never accidentally touch role/email/phoneNumber/createdAt
 * even if a future caller's object happens to carry extra keys (the
 * UpdatableUserProfileFields type already prevents that at compile time;
 * this explicit allowlist-copy is the runtime belt to that belt-and-
 * braces pairing, in case a caller uses `as` to bypass the type).
 */
export async function updateOwnProfile(
  uid: string,
  fields: UpdatableUserProfileFields
): Promise<void> {
  const update: Record<string, unknown> = {};
  if ('displayName' in fields) update.displayName = fields.displayName;
  if ('photoURL' in fields) update.photoURL = fields.photoURL;
  if ('languagePreference' in fields)
    update.languagePreference = fields.languagePreference;
  if ('themePreference' in fields) update.themePreference = fields.themePreference;
  if ('notificationsEnabled' in fields)
    update.notificationsEnabled = fields.notificationsEnabled;

  await updateDoc(doc(db, 'users', uid), update);
}
