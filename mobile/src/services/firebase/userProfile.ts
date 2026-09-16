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
 *
 * ensureOwnProfileExists (added during the V1 production-readiness audit):
 * functions/src/createUserProfile.ts's Auth trigger is meant to create this
 * document automatically on first sign-in, but Cloud Functions cannot
 * actually be deployed under this project's zero-billing constraint
 * (deploying any Cloud Function requires the Blaze plan even at $0 usage --
 * see PRODUCTION_READINESS.md). That means, in the real deployed app, the
 * trigger never runs at all -- not "rarely delayed" as subscribeToOwnProfile's
 * comment below used to assume, but *never*. Without this fallback, every
 * signed-in member would have no /users/{uid} document, forever: Profile/
 * Settings would never load, updateOwnProfile's updateDoc would fail with
 * not-found, and every Firestore rule that reads the caller's role
 * (isHostOrAbove() etc.) would find nothing and default-deny. This function
 * is the client-side equivalent of the Cloud Function, using the exact same
 * field shape and role, staying within what firestore.rules already allows
 * a client to do for its own new document (`allow create: if isOwner(userId)
 * && request.resource.data.role == 'member'`) -- no elevated role can ever
 * be granted this way, matching the trigger's own invariant.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
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
 * `onNext` receives `null` if the document doesn't exist yet. AuthContext.tsx
 * calls ensureOwnProfileExists() (below) right after sign-in specifically so
 * this stays a brief, one-time window rather than a permanent state -- see
 * that function's doc comment for why the Cloud Functions trigger this used
 * to rely on can't be depended on here.
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

/**
 * Creates /users/{uid} for the just-signed-in user if (and only if) it
 * doesn't already exist -- the client-side fallback for
 * functions/src/createUserProfile.ts's Auth trigger; see this file's header
 * comment for why that trigger can't be relied on here. Field shape and
 * `role: 'member'` deliberately mirror the Cloud Function exactly, and stay
 * inside what firestore.rules' `users/{userId}` create rule already permits
 * a client to write for itself -- this can never grant an elevated role,
 * exactly like the trigger it stands in for.
 *
 * Safe to call on every sign-in, not just the first: uses a transaction
 * (get-then-set, matching the Cloud Function's own idempotency strategy) so
 * an existing document -- including one whose role a Super Admin has since
 * elevated -- is never touched. Errors are intentionally not thrown to the
 * caller: a transient failure here shouldn't block sign-in itself, since
 * subscribeToOwnProfile()'s null case and updateOwnProfile()'s rejected
 * promise both already degrade safely if the document still doesn't exist
 * afterward, and the next sign-in (or app open) retries this automatically.
 */
export async function ensureOwnProfileExists(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  try {
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(userRef);
      if (snapshot.exists()) return;
      tx.set(userRef, {
        role: 'member',
        displayName: user.displayName ?? null,
        email: user.email ?? null,
        phoneNumber: user.phoneNumber ?? null,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.warn('[userProfile] ensureOwnProfileExists failed (will retry next sign-in):', error);
  }
}
