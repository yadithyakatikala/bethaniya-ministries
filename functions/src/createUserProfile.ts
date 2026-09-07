/**
 * createUserProfile — creates the Firestore /users/{uid} profile document
 * the very first time a Firebase Auth user is created (Google, Apple,
 * Phone OTP, or the admin's email/password account), per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 2 plan.
 *
 * Trust boundary (see /SECURITY.md): this runs on a `functions.auth.user()`
 * trigger, which the Admin SDK fires from Firebase's own Auth system, not
 * from anything the mobile/admin client supplies. The client never gets a
 * chance to set `role` (or any other field) here at all -- there is no
 * client-writable path to /users/{uid} on create for a role other than
 * 'member' in firestore.rules either (`allow create: if isOwner(userId) &&
 * request.resource.data.role == 'member'`), so this function and the rules
 * enforce the same invariant from two independent directions.
 *
 * Idempotency: Cloud Functions background triggers have at-least-once
 * delivery -- the same UserRecord.onCreate event can, rarely, be delivered
 * more than once. A Firestore transaction checks for an existing document
 * before writing, so a retried invocation is a no-op rather than a
 * duplicate write, and an existing document (including one whose `role`
 * a Super Admin has since elevated) is never overwritten.
 *
 * This file only contains the handler *logic* -- deliberately with no
 * import of `firebase-functions/v1` or `/v2` (their https/auth providers
 * transitively pull in an ESM-only dependency, jose via jwks-rsa, that
 * Jest's CommonJS transform cannot load; see the note in
 * __tests__/healthCheck.test.ts). The actual `functions.auth.user()`
 * trigger that wraps this handler lives in index.ts, which is not
 * unit-tested by direct import for the same reason. See
 * createUserProfile.test.ts for how the logic itself is tested, for real,
 * against a running Firestore emulator.
 *
 * v1 SDK note: Auth user-creation triggers (`functions.auth.user()`) only
 * exist in firebase-functions' v1 namespace -- there is no v2 equivalent
 * that fires *after* creation (v2's `identity` triggers are *blocking*
 * functions that run before creation and require Console-side blocking-
 * function configuration, which is unrelated to this repo's Firestore-role
 * model and not something Day 2 needs).
 */
import * as logger from 'firebase-functions/logger';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

export const MEMBER_ROLE = 'member' as const;

/** Fields Day 2 actually needs (Admin Users page: name, email, phone, role,
 * join date, per FINAL_ARCHITECTURE_SPECIFICATION.md's Day 11 plan) --
 * nothing else is collected. */
export interface UserProfileDocument {
  role: typeof MEMBER_ROLE;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  createdAt: FieldValue;
}

/** The subset of firebase-admin's UserRecord this handler actually reads --
 * kept as a narrow interface so it's trivial to unit-test with a plain
 * object instead of a full UserRecord. */
export interface AuthUserLike {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
}

/**
 * The actual logic, exported separately from the trigger wrapper below so
 * it can be unit-tested directly (a plain async function, no Cloud
 * Functions test harness needed) against a real Firestore emulator via
 * FIRESTORE_EMULATOR_HOST. See createUserProfile.test.ts.
 */
export async function createUserProfileHandler(user: AuthUserLike): Promise<void> {
  const db = getFirestore();
  const userRef = db.collection('users').doc(user.uid);

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(userRef);
    if (snapshot.exists) {
      // Safe on retry, and safe if this ever runs for a uid whose role a
      // Super Admin has since changed -- never touch an existing document.
      logger.info(`createUserProfile: profile already exists for ${user.uid}, skipping`);
      return;
    }

    const profile: UserProfileDocument = {
      role: MEMBER_ROLE,
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      phoneNumber: user.phoneNumber ?? null,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(userRef, profile);
    logger.info(
      `createUserProfile: created profile for ${user.uid} with role '${MEMBER_ROLE}'`
    );
  });
}
