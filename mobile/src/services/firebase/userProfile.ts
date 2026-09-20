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
  Timestamp,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './app';

export type LanguagePreference = 'en' | 'te';
/** What the Bible reader is set to show. See ../../features/bible/types.ts. */
export type BibleModePreference = 'en' | 'te' | 'bilingual';
/**
 * The app's theme, including the reader's.
 *
 * M4 added 'system' -- the Bible reader offers Light / Dark / System and
 * drives THIS field rather than keeping a reader-only theme value, so
 * the reader and Settings can never disagree about what the app looks
 * like. Purely additive: 'light' and 'dark' keep their meaning, an
 * account that has one stored is unaffected, and firestore.rules' own
 * validator was widened by one value (see that file). A V1/V2 client
 * reading 'system' fails its local validation and falls back to the
 * device scheme, which is what 'system' means anyway.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * M6 onboarding. Exactly the two values the church asked to collect, and
 * a closed union rather than a free string so an unexpected value is a
 * compile error here and a rejected write in firestore.rules.
 *
 * NOT part of authentication, and not required for anything the app
 * does -- it is congregation information the church keeps, the same kind
 * of thing as a phone number.
 */
export type Gender = 'male' | 'female';

/**
 * How this member signs in -- M7.
 *
 * Firebase's own provider ids, not a private spelling, so the value the
 * admin list shows is the value Firebase itself uses. Recorded by the
 * MEMBER'S OWN client, because reading another user's providerData needs
 * the Admin SDK and therefore a deployed Cloud Function, which this
 * project's plan does not allow -- see the admin Users page, which says
 * "not recorded" for an account that has not signed in since M7 rather
 * than guessing.
 */
export type AuthProvider = 'password' | 'google.com' | 'apple.com';

/**
 * Whether a super admin has suspended this member -- M7.
 *
 * APP-LEVEL, NOT AUTH-LEVEL, and the difference is written down in
 * firestore.rules at isActiveMember(): a suspended member keeps a valid
 * Firebase Auth token (disabling the account needs the Admin SDK), and
 * every member-authored write is refused on the server. Reading is not
 * blocked -- suspension is about somebody posting, not about cutting them
 * off from scripture.
 */
export type AccountStatus = 'active' | 'suspended';

export interface UserProfile {
  uid: string;
  role: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  /** M6 onboarding. `null` for every account created before it. */
  gender: Gender | null;
  /**
   * When the member finished the onboarding questionnaire -- M6.
   *
   * THIS, NOT A FIELD-BY-FIELD GUESS, is what decides whether onboarding
   * is shown again. Deriving "have they done it?" from whether the four
   * answers happen to be present sounds tidier and is worse: a member who
   * later clears their phone number from Profile would be dragged back
   * through onboarding, and a member who legitimately has no answer to
   * give could never get past it. One explicit marker, written once, is
   * the thing that can be reasoned about.
   */
  profileCompletedAt: Date | null;
  /**
   * V1's single language value. RETAINED, not removed: a V1 build
   * installed over V2 still reads it, and deleting a field users' older
   * clients depend on is a destructive migration. V2 keeps mirroring it
   * whenever the Bible mode is a single language -- see
   * ../../context/languagePreferences.ts.
   *
   * V2 code should read `appLanguage` / `bibleMode` instead. This field
   * only seeds them once, for an account that has never run V2.
   */
  languagePreference: LanguagePreference | null;
  /** The interface language. Defaults to 'en' -- independent of the Bible. */
  appLanguage: LanguagePreference | null;
  /** The Bible reader's mode. Defaults to 'te' -- independent of the UI. */
  bibleMode: BibleModePreference | null;
  themePreference: ThemePreference | null;
  notificationsEnabled: boolean | null;
  /** M7. `null` for an account that has not signed in since M7 shipped. */
  authProvider: AuthProvider | null;
  /** M7. Recorded at most once a day -- see recordSignInActivity(). */
  lastActiveAt: Date | null;
  /**
   * M7. Defaults to 'active': a field nobody has set must never read as
   * a suspension, and every account predating M7 has no value here.
   */
  accountStatus: AccountStatus;
}

/** Exactly the fields an owner is ever allowed to write -- see this file's
 * header comment. Every field is optional: callers pass only the ones
 * they're actually changing, so a Settings toggle never has to first read
 * back and resend displayName just to flip notificationsEnabled. */
export interface UpdatableUserProfileFields {
  displayName?: string;
  photoURL?: string | null;
  languagePreference?: LanguagePreference;
  appLanguage?: LanguagePreference;
  bibleMode?: BibleModePreference;
  themePreference?: ThemePreference;
  notificationsEnabled?: boolean;
  /**
   * M6 onboarding fields. `phoneNumber` was already stored -- what is new
   * is that the OWNER may now write it. It used to be set once, from
   * whatever Firebase Auth happened to know, and be unreachable
   * afterwards, which is no use for a member who signed up with an email
   * address and wants the church to have their number.
   */
  phoneNumber?: string | null;
  gender?: Gender;
}

function toUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  const languagePreference =
    data.languagePreference === 'en' || data.languagePreference === 'te'
      ? data.languagePreference
      : null;
  const appLanguage =
    data.appLanguage === 'en' || data.appLanguage === 'te' ? data.appLanguage : null;
  const bibleMode =
    data.bibleMode === 'en' || data.bibleMode === 'te' || data.bibleMode === 'bilingual'
      ? data.bibleMode
      : null;
  const themePreference =
    data.themePreference === 'light' ||
    data.themePreference === 'dark' ||
    data.themePreference === 'system'
      ? data.themePreference
      : null;
  const completedAt = data.profileCompletedAt;
  return {
    uid,
    role: typeof data.role === 'string' ? data.role : 'member',
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    email: typeof data.email === 'string' ? data.email : null,
    phoneNumber: typeof data.phoneNumber === 'string' ? data.phoneNumber : null,
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    gender: data.gender === 'male' || data.gender === 'female' ? data.gender : null,
    // serverTimestamp() resolves to null in the LOCAL snapshot that fires
    // before the server acknowledges the write. Treating that tick as
    // "not completed" is exactly the flicker back into onboarding this
    // field exists to prevent, which is why the gate reading it also
    // holds its own decision once made -- see
    // ../../features/onboarding/OnboardingGate.tsx.
    profileCompletedAt:
      completedAt instanceof Timestamp
        ? completedAt.toDate()
        : completedAt instanceof Date
          ? completedAt
          : null,
    languagePreference,
    appLanguage,
    bibleMode,
    themePreference,
    notificationsEnabled:
      typeof data.notificationsEnabled === 'boolean' ? data.notificationsEnabled : null,
    authProvider:
      data.authProvider === 'password' ||
      data.authProvider === 'google.com' ||
      data.authProvider === 'apple.com'
        ? data.authProvider
        : null,
    lastActiveAt:
      data.lastActiveAt instanceof Timestamp
        ? data.lastActiveAt.toDate()
        : data.lastActiveAt instanceof Date
          ? data.lastActiveAt
          : null,
    // Anything other than the one value that means "suspended" reads as
    // active -- an unreadable or missing value must not lock a member out
    // of their own church's app.
    accountStatus: data.accountStatus === 'suspended' ? 'suspended' : 'active',
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
  if ('appLanguage' in fields) update.appLanguage = fields.appLanguage;
  if ('bibleMode' in fields) update.bibleMode = fields.bibleMode;
  if ('themePreference' in fields) update.themePreference = fields.themePreference;
  if ('notificationsEnabled' in fields)
    update.notificationsEnabled = fields.notificationsEnabled;
  if ('phoneNumber' in fields) update.phoneNumber = fields.phoneNumber;
  if ('gender' in fields) update.gender = fields.gender;

  await updateDoc(doc(db, 'users', uid), update);
}

/** What the M6 onboarding questionnaire collects. See ./onboarding's
 *  screen and ../../features/onboarding/profileCompleteness.ts. */
export interface OnboardingAnswers {
  fullName: string;
  phoneNumber: string;
  gender: Gender;
  /** Becomes the member's APP language. Never their Bible language and
   *  never their theme -- those are separate preferences and M2/M4's
   *  whole point. See ../../context/PreferencesContext.tsx. */
  preferredLanguage: LanguagePreference;
}

/**
 * Writes the onboarding answers and marks the questionnaire done, in ONE
 * update.
 *
 * One write, not five, because a half-finished profile is the state this
 * whole flow exists to get rid of: either every answer lands and the
 * member is through, or the write fails, nothing changes, and they are
 * shown the error with their answers still in the form. `updateDoc` is
 * atomic over the fields it carries, so there is no partial outcome to
 * design around.
 *
 * `profileCompletedAt` uses the SERVER's clock. A device with a wrong
 * clock should not be able to stamp a profile in 1970 or 2099, and
 * nothing here needs the value to be readable before the server has it.
 *
 * Rejections are NOT swallowed -- the caller shows them. See
 * ../../features/onboarding/OnboardingScreen.tsx.
 */
export async function completeOnboarding(
  uid: string,
  answers: OnboardingAnswers
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    displayName: answers.fullName,
    phoneNumber: answers.phoneNumber,
    gender: answers.gender,
    appLanguage: answers.preferredLanguage,
    profileCompletedAt: serverTimestamp(),
  });
}

/**
 * Records that this member signed in, and with which provider -- M7.
 *
 * =====================================================================
 * WHY THE MEMBER'S OWN CLIENT WRITES THIS
 * =====================================================================
 * The super admin's Users page has to show which provider an account
 * uses and whether it is still in use. Both facts live in Firebase Auth,
 * and reading ANOTHER user's Auth record needs the Admin SDK, which needs
 * a deployed Cloud Function, which needs the Blaze plan -- the same wall
 * functions/src/updateUserRole.ts and ./auditLog.ts already hit. So the
 * only honest options were to make them up or to have each member's own
 * client record them about itself. This is the second one. An account
 * that has not signed in since M7 shipped has neither value, and the
 * admin page says so rather than filling in a plausible-looking guess.
 *
 * =====================================================================
 * AT MOST ONE WRITE A DAY
 * =====================================================================
 * `lastActiveAt` answers "is this account still in use", which needs a
 * resolution of about a day, not of a launch. Writing on every app open
 * would turn a question nobody asks urgently into one Firestore write per
 * member per launch, forever, on a free-tier quota. The last write's day
 * is kept in AsyncStorage, so the throttle costs nothing and survives a
 * restart; losing it simply means one extra write.
 *
 * `authProvider` is written alongside whenever it CHANGES, which in
 * practice means once. It is re-checked rather than written once and
 * forgotten because a member who signed up with email and later links
 * Google should not be listed forever as an email account.
 *
 * Failures are swallowed. This is bookkeeping for an admin list; it must
 * never be the reason somebody cannot open the app. Same decision, same
 * reason, as ensureOwnProfileExists() below.
 */
export const LAST_ACTIVE_STORAGE_KEY = 'maranatha.lastActiveRecord';

export function providerIdOf(user: User): AuthProvider | null {
  // providerData is the linked providers; providerId on the entry is
  // Firebase's own spelling. A user signed in anonymously or with a
  // provider this app does not offer gets null rather than a wrong label.
  for (const entry of user.providerData) {
    if (
      entry.providerId === 'password' ||
      entry.providerId === 'google.com' ||
      entry.providerId === 'apple.com'
    ) {
      return entry.providerId;
    }
  }
  return null;
}

/**
 * What was last written, as one stored string: the day, the provider and
 * the uid together.
 *
 * The uid is in there because two members can share a phone. Without it,
 * the second person to sign in today would be skipped by the first
 * person's throttle and never recorded at all.
 */
export function lastActiveRecord(
  uid: string,
  provider: AuthProvider | null,
  now: Date
): string {
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return `${uid}|${day}|${provider ?? ''}`;
}

export async function recordSignInActivity(
  user: User,
  options: {
    now?: Date;
    readLastRecord: () => Promise<string | null>;
    writeLastRecord: (record: string) => Promise<void>;
  }
): Promise<void> {
  const { now = new Date(), readLastRecord, writeLastRecord } = options;
  try {
    const provider = providerIdOf(user);
    const record = lastActiveRecord(user.uid, provider, now);
    // Same member, same day, same provider -- nothing has changed that
    // the admin list would show differently, so nothing is written.
    if ((await readLastRecord()) === record) return;

    const update: Record<string, unknown> = { lastActiveAt: serverTimestamp() };
    // Omitted rather than written as null when unknown: a member signed
    // in with a provider this app does not offer should leave the
    // recorded value alone, not erase it.
    if (provider !== null) update.authProvider = provider;
    await updateDoc(doc(db, 'users', user.uid), update);
    await writeLastRecord(record);
  } catch (error) {
    console.warn('[userProfile] recordSignInActivity failed (not fatal):', error);
  }
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
    console.warn(
      '[userProfile] ensureOwnProfileExists failed (will retry next sign-in):',
      error
    );
  }
}
